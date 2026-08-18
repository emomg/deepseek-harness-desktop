use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const DSH_URL: &str = "http://127.0.0.1:3080";
const DSH_ADDR: &str = "127.0.0.1:3080";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 桌面版自身的 GitHub 仓库（更新检查来源，同时用于 API 与下载页）。
const UPDATE_REPO: &str = "emomg/deepseek-harness-desktop";
/// GitHub API 最新 release 端点。
const UPDATE_API_URL: &str =
    "https://api.github.com/repos/emomg/deepseek-harness-desktop/releases/latest";
/// 人工下载页（无 API 可用时的兜底链接）。
const UPDATE_PAGE_URL: &str = "https://github.com/emomg/deepseek-harness-desktop/releases/latest";

/// 更新检查的仓库名（日志/诊断用，避免常量未使用告警）。
fn update_repo_label() -> &'static str {
    UPDATE_REPO
}

/// 当前桌面壳版本（Cargo.toml 的 version）。
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// 运行日志（exe 同目录 dsh-pro.log）：记录启动/窗口/退出事件，便于诊断。
pub(crate) fn pro_log(line: &str) {
    use std::io::Write;
    let path = std::env::current_exe()
        .ok()
        .map(|p| p.with_file_name("dsh-pro.log"))
        .unwrap_or_else(|| std::path::PathBuf::from("dsh-pro.log"));
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let _ = writeln!(f, "[{ts}] {line}");
    }
    eprintln!("[dsh-pro] {line}");
}

/// 用捆绑/系统的 node 跑一小段 fetch 脚本，取 GitHub 最新 release 的 tag 和页面。
/// 返回 (tag, html_url, asset_url, digest)；任何一步失败返回 None（网络不可用、node 缺失等，均静默）。
/// edition: "lite" | "full" | "pro" —— 决定下载哪个安装包变体。
fn fetch_latest_release(edition: &str) -> Option<(String, String, Option<String>, Option<String>)> {
    // 优先捆绑运行时里的 node（-full 版），其次 PATH/Program Files 里的 node。
    let node = bundled_runtime()
        .map(|(n, _)| n)
        .or_else(find_node)?;
    let script = format!(
        r#"const r = await fetch('{api}', {{
  headers: {{ 'User-Agent': 'dsh-desktop-update-check', 'Accept': 'application/vnd.github+json' }}
}});
if (!r.ok) process.exit(2);
const j = await r.json();
console.log(j.tag_name || '');
console.log(j.html_url || '');
const edition = '{edition}';
const all = (j.assets || []).filter(a => a.name && a.name.endsWith('.exe'));
let asset;
if (edition === 'pro') {{
  asset = all.find(a => a.name.includes('-pro.exe')) || all.find(a => a.name.includes('-full.exe')) || all[0];
}} else if (edition === 'full') {{
  asset = all.find(a => a.name.includes('-full.exe')) || all[0];
}} else {{
  // 精简版：只认不带 -full / -pro 后缀的裸 Setup-x.y.z.exe，避免被推荐成专业版安装包。
  asset = all.find(a => !a.name.includes('-full') && !a.name.includes('-pro'))
    || all.find(a => a.name.endsWith('.exe'));
}}
console.log(asset ? (asset.browser_download_url || '') : '');
console.log(asset ? (asset.digest || '') : '');
"#,
        api = UPDATE_API_URL,
        edition = edition
    );
    let out = Command::new(&node).args(["-e", &script]).output().ok()?;
    eprintln!("[dsh-desktop] checking updates for {}", update_repo_label());
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut lines = text.lines();
    let tag = lines.next()?.trim().to_string();
    let url = lines.next()?.trim().to_string();
    if tag.is_empty() {
        return None;
    }
    let asset = lines.next().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let digest = lines.next().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    Some((
        tag,
        if url.is_empty() { UPDATE_PAGE_URL.to_string() } else { url },
        asset,
        digest,
    ))
}

/// 校验下载文件的 SHA256 是否与 GitHub 公布的 digest 一致（防篡改）。
fn verify_digest(path: &Path, expected: &str) -> bool {
    use sha2::Digest;
    use std::io::Read;
    let digest = expected.strip_prefix("sha256:").unwrap_or(expected);
    let Ok(mut f) = std::fs::File::open(path) else { return false };
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        match f.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buf[..n]),
            Err(_) => return false,
        }
    }
    let actual = format!("{:x}", hasher.finalize());
    actual.eq_ignore_ascii_case(digest)
}

/// 用 node 下载安装包到系统临时目录（随机文件名，避免固定路径被预置），返回本地路径。
fn download_installer(url: &str) -> Option<PathBuf> {
    let node = bundled_runtime()
        .map(|(n, _)| n)
        .or_else(find_node)?;
    let nonce: u64 = {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now().duration_since(UNIX_EPOCH).ok().map(|d| d.as_nanos() as u64).unwrap_or(0)
            ^ std::process::id() as u64
    };
    let dest = std::env::temp_dir().join(format!("dsh-desktop-setup-{nonce:x}.exe"));
    let script = r#"
const fs = require('node:fs');
const r = await fetch(process.argv[1], { headers: { 'User-Agent': 'dsh-desktop-update' } });
if (!r.ok) process.exit(2);
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(process.argv[2], buf);
console.log('downloaded ' + buf.length);
"#;
    let out = Command::new(&node)
        .args(["-e", script, url, &dest.to_string_lossy()])
        .output()
        .ok()?;
    if !out.status.success() || !dest.is_file() {
        return None;
    }
    Some(dest)
}

/// 静默运行 NSIS 安装器（/S），等待完成。
fn run_installer(path: &Path) -> bool {
    match Command::new(path)
        .arg("/S")
        .creation_flags(CREATE_NO_WINDOW)
        .status()
    {
        Ok(status) => status.success(),
        Err(_) => false,
    }
}

/// 当前安装的版本变体：读取 exe 同目录 edition.txt（lite / full / pro）。
/// 缺失或内容非法时返回 None，调用方按旧逻辑回退。
fn current_edition() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let text = std::fs::read_to_string(dir.join("edition.txt")).ok()?;
    let edition = text.trim().to_ascii_lowercase();
    if ["lite", "full", "pro"].contains(&edition.as_str()) {
        Some(edition)
    } else {
        None
    }
}

/// 查找已安装桌面版 exe（AppData 安装目录）。
fn installed_exe() -> Option<PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    let p = Path::new(&local).join("Programs").join("DeepSeek Harness").join("dsh-desktop.exe");
    p.is_file().then_some(p)
}

/// 解析 "v0.1.1" / "0.1.1" 为 (0,1,1)；解析失败返回 None。
fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let v = v.trim_start_matches('v');
    let mut it = v.split('.');
    let major = it.next()?.parse().ok()?;
    let minor = it.next()?.parse().ok()?;
    let patch = it.next()?.parse().ok()?;
    Some((major, minor, patch))
}

/// 远程 tag 是否严格新于当前版本（按 semver 比较，忽略预发布段差异）。
fn is_newer(tag: &str, current: &str) -> bool {
    match (parse_version(tag), parse_version(current)) {
        (Some(r), Some(c)) => r > c,
        _ => false,
    }
}

#[cfg(windows)]
fn show_update_dialog(title: &str, message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    let t = wide(title);
    let m = wide(message);
    unsafe {
        MessageBoxW(std::ptr::null_mut(), m.as_ptr(), t.as_ptr(), MB_OK | MB_ICONINFORMATION);
    }
}

/// 弹出"是/否"确认框，返回用户是否点了"是"。
#[cfg(windows)]
fn confirm_update_dialog(title: &str, message: &str) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONQUESTION, MB_YESNO, IDYES};

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    let t = wide(title);
    let m = wide(message);
    unsafe {
        MessageBoxW(std::ptr::null_mut(), m.as_ptr(), t.as_ptr(), MB_YESNO | MB_ICONQUESTION) == IDYES
    }
}

/// 执行一次完整检查：拉取最新 release，比较版本；有新版本时询问是否自动下载安装。
/// 在线程里调用（不阻塞 UI）；安装完成后退出当前应用并启动新版。
#[cfg(windows)]
fn run_update_check(app: tauri::AppHandle) {
    let current = APP_VERSION.to_string();
    // 当前是 -full 自包含版（exe 同级有 runtime）则更新 full 安装包，否则更新精简版。
    // 当前安装的版本变体：安装包在 exe 同级写 edition.txt（lite / full / pro）。
    // 读不到时按旧逻辑推断：有捆绑运行时视为 full，否则 lite。
    let edition = current_edition().unwrap_or_else(|| {
        if bundled_runtime().is_some() {
            "full".to_string()
        } else {
            "lite".to_string()
        }
    });
    match fetch_latest_release(&edition) {
        None => {
            show_update_dialog(
                "检查更新",
                &format!(
                    "无法连接 GitHub 检查更新（网络不可用或 node 缺失）。

当前版本：v{current}
可手动访问：
{UPDATE_PAGE_URL}"
                ),
            );
        }
        Some((tag, _url, asset_url, digest)) => {
            if !is_newer(&tag, &current) {
                show_update_dialog("检查更新", &format!("当前已是最新版本 v{current}。"));
                return;
            }
            let msg = format!(
                "发现新版本 v{tag}（当前 v{current}）。

是否立即下载并自动安装？"
            );
            if !confirm_update_dialog("发现新版本", &msg) {
                return;
            }
            let Some(url) = asset_url else {
                show_update_dialog("更新失败", "无法获取安装包下载地址，请手动访问下载页。");
                return;
            };
            // 安全：只接受本仓库官方 GitHub 域名下的安装包，拒绝重定向到其他来源。
            let trusted = url.starts_with("https://github.com/emomg/deepseek-harness-desktop/releases/download/");
            if !trusted {
                show_update_dialog("更新失败", "安装包下载地址异常，已取消自动更新。请手动访问下载页。");
                return;
            }
            show_update_dialog("正在下载", "正在下载新版本安装包，请稍候…");
            let Some(setup) = download_installer(&url) else {
                show_update_dialog("更新失败", "下载安装包失败，请稍后重试或手动访问下载页。");
                return;
            };
            // 安全：校验 SHA256 与 GitHub 公布的 digest 一致，防止下载被篡改。
            if let Some(expected) = digest {
                if !verify_digest(&setup, &expected) {
                    let _ = std::fs::remove_file(&setup);
                    show_update_dialog("更新失败", "安装包完整性校验失败（SHA256 不匹配），已取消安装。");
                    return;
                }
            }
            if !run_installer(&setup) {
                show_update_dialog("更新失败", "安装程序启动失败，请手动运行安装包。");
                return;
            }
            // 安装完成：启动新版 exe 并退出当前应用（旧进程让位给新版）。
            if let Some(exe) = installed_exe() {
                let _ = Command::new(&exe).spawn();
                app.exit(0);
            } else {
                show_update_dialog("更新完成", &format!("新版本 v{tag} 已安装完成，请重新打开桌面版。"));
            }
        }
    }
}

/// 桌面端自己拉起的 dsh 子进程；如果端口本来就活着则不拉起。
/// 退出应用时**保留**该进程（见 RunEvent::Exit）：dsh web 常驻后台，
/// 下次打开桌面端秒连，不再每次冷启动等几十秒；移动端也可随时连接。
struct DshServer(Mutex<Option<Child>>);

/// 服务是否真正可用：TCP 握手 + 一次 HTTP GET /（读到响应才算就绪）。
/// 仅 TCP connect 成功太早 —— socket 先于业务路由监听，浏览器会命中
/// 半启动的服务（无 boot manifest、请求挂起），表现为启动更慢/白屏。
pub(crate) fn port_alive() -> bool {
    use std::io::{Read, Write};
    let Ok(mut stream) = TcpStream::connect_timeout(&DSH_ADDR.parse().unwrap(), Duration::from_millis(400))
    else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(800)));
    if stream.write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n").is_err() {
        return false;
    }
    let mut buf = [0u8; 128];
    match stream.read(&mut buf) {
        Ok(n) => n > 0,
        Err(_) => false,
    }
}

fn wait_for_port(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if port_alive() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    port_alive()
}

/// 在 PATH 中查找可执行文件（where.exe 输出第一行）。
fn find_on_path(exe: &str) -> Option<PathBuf> {
    let out = Command::new("where").arg(exe).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&out.stdout).lines().next()?.trim().to_string();
    if line.is_empty() {
        None
    } else {
        Some(PathBuf::from(line))
    }
}

fn find_node() -> Option<PathBuf> {
    if let Some(node) = find_on_path("node") {
        return Some(node);
    }
    // 兜底：Program Files\nodejs
    let pf = std::env::var_os("ProgramFiles")?;
    let p = Path::new(&pf).join("nodejs").join("node.exe");
    p.is_file().then_some(p)
}

/// 定位 npm 全局安装的 @deepseek-ai/dsh（lib/bin.js），不依赖任何硬编码路径。
fn find_global_dsh_bin() -> Option<PathBuf> {
    let node = find_node()?;
    let out = Command::new(&node)
        .args(["--no-warnings", "-e"])
        .arg(
            "const{execSync}=require('child_process');console.log(execSync('npm root -g',{encoding:'utf8'}).trim())",
        )
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let root = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if root.is_empty() {
        return None;
    }
    let bin = Path::new(&root).join("@deepseek-ai").join("dsh").join("lib").join("bin.js");
    bin.is_file().then_some(bin)
}

/// 安装包自带的捆绑运行时（exe 同级目录 runtime\），小白无需预装 Node/dsh。
fn bundled_runtime() -> Option<(PathBuf, PathBuf)> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let node = dir.join("runtime").join("node.exe");
    let bin_js = dir
        .join("runtime")
        .join("node_modules")
        .join("@deepseek-ai")
        .join("dsh")
        .join("lib")
        .join("bin.js");
    (node.is_file() && bin_js.is_file()).then_some((node, bin_js))
}

#[cfg(windows)]
fn show_dsh_missing_dialog() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK};

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    let title = wide("DeepSeek Harness");
    let msg = wide(
        "未找到 dsh 命令行工具（DeepSeek Harness 服务端）。\n\n         请先安装：\n         npm install -g @deepseek-ai/dsh\n\n         然后重新启动本应用。",
    );
    unsafe {
        MessageBoxW(std::ptr::null_mut(), msg.as_ptr(), title.as_ptr(), MB_OK | MB_ICONWARNING);
    }
}

#[cfg(windows)]
fn show_dsh_not_ready_dialog() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK};

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    let title = wide("DeepSeek Harness");
    let msg = wide(
        "dsh 服务未能启动（127.0.0.1:3080 无响应）。\n\n\
         请尝试：\n\
         1. 在命令行运行 dsh web，看是否报错（桌面端会自动检测并连接）；\n\
         2. 或安装 -full 自包含版（自带运行时，无需手动配置）。\n\n\
         如果桌面端已自动拉起服务但启动较慢，请稍后重新打开应用。",
    );
    unsafe {
        MessageBoxW(std::ptr::null_mut(), msg.as_ptr(), title.as_ptr(), MB_OK | MB_ICONWARNING);
    }
}

/// 定位用户 web profile 目录（$DSH_HOME/profiles/web，缺省 ~/.dsh/profiles/web）。
fn web_profile_dir() -> Option<PathBuf> {
    let home = std::env::var_os("DSH_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            let user = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
            Some(Path::new(&user).join(".dsh"))
        })?;
    Some(home.join("profiles").join("web"))
}

/// 安装包内置的插件目录（exe 同级 plugins\<name>\，每个含 package.json）。
fn bundled_plugin_dirs() -> Vec<PathBuf> {
    let Some(exe) = std::env::current_exe().ok() else { return Vec::new() };
    let Some(dir) = exe.parent() else { return Vec::new() };
    let plugins_root = dir.join("plugins");
    let Ok(entries) = std::fs::read_dir(&plugins_root) else { return Vec::new() };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && path.join("package.json").is_file() {
            out.push(path);
        }
    }
    out.sort();
    out
}

/// 读取插件 package.json 的 name 字段（bundle 注册名，如 "dsh-files"）。
fn plugin_package_name(dir: &Path) -> Option<String> {
    let text = std::fs::read_to_string(dir.join("package.json")).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;
    json.get("name")?.as_str().map(|s| s.to_string())
}

/// 确保安装包内置插件已注册进 web profile：
///  - 保证 profile 目录与基础 package.json 存在；
///  - 对每个内置插件，若 `dsh.profile.bundles` 未含其 name，则
///    junction 到 profile\node_modules\<name> 并追加 bundle；
///  - 幂等：已注册的插件跳过，可安全重复调用。
/// 返回注册成功/失败的插件数（仅日志用）。
fn ensure_plugins_registered() -> (usize, usize) {
    let Some(profile) = web_profile_dir() else { return (0, 0) };
    if std::fs::create_dir_all(&profile).is_err() {
        return (0, 0);
    }
    // 基础 package.json：缺省时创建（bundles 留空，dsh 首次启动自行补 base/web-app）。
    let pkg_path = profile.join("package.json");
    if !pkg_path.is_file() {
        let base = r#"{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {},
  "dsh": { "profile": { "bundles": [] } }
}
"#;
        let _ = std::fs::write(&pkg_path, base);
    }
    let Ok(text) = std::fs::read_to_string(&pkg_path) else { return (0, 0) };
    let Ok(mut pkg) = serde_json::from_str::<serde_json::Value>(&text) else { return (0, 0) };

    let node_modules = profile.join("node_modules");
    let _ = std::fs::create_dir_all(&node_modules);

    let mut ok = 0usize;
    let mut fail = 0usize;
    for plugin in bundled_plugin_dirs() {
        let Some(name) = plugin_package_name(&plugin) else { continue };
        // bundles 已含 → 幂等跳过
        let bundles = pkg
            .pointer("/dsh/profile/bundles")
            .and_then(|b| b.as_array())
            .cloned()
            .unwrap_or_default();
        if bundles.iter().any(|b| b.as_str() == Some(name.as_str())) {
            ok += 1;
            continue;
        }
        // junction 插件目录 → profile\node_modules\<name>
        let link = node_modules.join(&name);
        let linked = if link.is_dir() {
            true // 已存在（之前注册过或用户手动装过）
        } else {
            // junction 无需管理员权限；mklink /J <link> <target>
            let status = Command::new("cmd")
                .args(["/c", "mklink", "/J"])
                .arg(&link)
                .arg(&plugin)
                .creation_flags(CREATE_NO_WINDOW)
                .status();
            status.map(|s| s.success()).unwrap_or(false)
        };
        if !linked {
            fail += 1;
            pro_log(&format!("[plugins] failed to link {name}"));
            continue;
        }
        // 追加 bundle
        let mut new_bundles = bundles;
        new_bundles.push(serde_json::Value::String(name.clone()));
        if let Some(obj) = pkg.as_object_mut() {
            if let Some(dsh) = obj.get_mut("dsh").and_then(|d| d.as_object_mut()) {
                if let Some(profile_obj) = dsh.get_mut("profile").and_then(|p| p.as_object_mut()) {
                    profile_obj.insert("bundles".into(), serde_json::Value::Array(new_bundles));
                }
            }
        }
        if std::fs::write(&pkg_path, serde_json::to_string_pretty(&pkg).unwrap_or_default()).is_ok() {
            ok += 1;
            pro_log(&format!("[plugins] registered {name}"));
        } else {
            fail += 1;
            pro_log(&format!("[plugins] failed to persist {name}"));
        }
    }
    (ok, fail)
}

fn spawn_dsh() -> Option<Child> {
    // 0) 安装包自带的捆绑运行时（最优先，小白无需安装任何东西）
    if let Some((node, bin_js)) = bundled_runtime() {
        if let Ok(child) = Command::new(&node)
            .arg(&bin_js)
            .arg("web")
            .env("DSH_DESKTOP_VERSION", env!("CARGO_PKG_VERSION"))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
        {
            return Some(child);
        }
    }
    // 1) PATH 中的 dsh shim（npm 全局安装，.cmd 需要 cmd 壳）
    if find_on_path("dsh").is_some() {
        if let Ok(child) = Command::new("cmd")
            .args(["/c", "dsh", "web"])
            .env("DSH_DESKTOP_VERSION", env!("CARGO_PKG_VERSION"))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
        {
            return Some(child);
        }
    }
    // 2) 兜底：node 直接运行 npm 全局安装的 @deepseek-ai/dsh
    if let (Some(node), Some(bin_js)) = (find_node(), find_global_dsh_bin()) {
        if let Ok(child) = Command::new(&node)
            .arg(&bin_js)
            .arg("web")
            .env("DSH_DESKTOP_VERSION", env!("CARGO_PKG_VERSION"))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
        {
            return Some(child);
        }
    }
    // 3) 都找不到：弹窗说明后退出
    show_dsh_missing_dialog();
    std::process::exit(1);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 崩溃日志写到 exe 同目录，便于用户上报（见 start.md 常见问题）
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {}\n", info);
        let log_path = std::env::current_exe()
            .ok()
            .map(|p| p.with_file_name("dsh-desktop-panic.log"))
            .unwrap_or_else(|| std::path::PathBuf::from("dsh-desktop-panic.log"));
        let _ = std::fs::write(log_path, msg.as_bytes());
        let _ = std::io::Write::write_all(&mut std::io::stderr(), msg.as_bytes());
    }));
    let app = tauri::Builder::default()
        .setup(|app| {
            pro_log("app starting");
            app.manage(DshServer(Mutex::new(None)));

            // 主窗口立即创建并显示占位页（"正在启动 DSH 服务…"），避免窗口迟迟不出现
            let win = match WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("DeepSeek Harness")
            .inner_size(1280.0, 820.0)
            .min_inner_size(800.0, 600.0)
            .build()
            {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("[dsh-desktop] window build failed: {e:?}");
                    return Err(e.into());
                }
            };
            let _ = win.show();
            let _ = win.set_focus();
            let main_handle = win.clone();

            // 后台线程拉起 dsh（不阻塞窗口显示）并等待端口就绪
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                // 安装包内置插件：dsh 启动前注册进 web profile（幂等）。
                // 仅当没有复用已有 dsh 实例时才注册——端口已活说明 profile 已由
                // 既有环境管理，直接复用，不打扰用户配置。
                let alive = port_alive();
                if !alive {
                    let (ok, fail) = ensure_plugins_registered();
                    if ok > 0 || fail > 0 {
                        pro_log(&format!("[plugins] registered {ok} ok, {fail} failed"));
                    }
                }
                let child = if alive { None } else { spawn_dsh() };
                if let Some(state) = app_handle.try_state::<DshServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        *guard = child;
                    }
                }
                let ready = wait_for_port(Duration::from_secs(180));
                eprintln!("[dsh-desktop] dsh port ready: {ready}");
                let nav = main_handle.clone();
                let _ = app_handle.run_on_main_thread(move || {
                    if ready {
                        let _ = nav.navigate(DSH_URL.parse().unwrap());
                    } else {
                        show_dsh_not_ready_dialog();
                    }
                });
            });

            // 启动后静默检查一次桌面版更新（后台线程，不阻塞；有新版本才提示）。
            // 环境变量 DSH_PRO_DISABLE_UPDATE=1 可关闭（测试/无网/不想被打扰时）。
            if std::env::var_os("DSH_PRO_DISABLE_UPDATE").is_none() {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(5));
                    run_update_check(handle);
                });
            }

            // 托盘：显示主窗口 / 检查更新 / 退出
            let update_item = match MenuItem::with_id(app, "update-check", "检查更新", true, None::<&str>)
            {
                Ok(i) => i,
                Err(e) => {
                    eprintln!("[dsh-desktop] menu item failed: {e:?}");
                    return Err(e.into());
                }
            };
            let show_item = match MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)
            {
                Ok(i) => i,
                Err(e) => {
                    eprintln!("[dsh-desktop] menu item failed: {e:?}");
                    return Err(e.into());
                }
            };
            let quit_item = match MenuItem::with_id(app, "quit", "退出", true, None::<&str>) {
                Ok(i) => i,
                Err(e) => {
                    eprintln!("[dsh-desktop] menu item failed: {e:?}");
                    return Err(e.into());
                }
            };
            let menu = match Menu::with_items(app, &[&update_item, &show_item, &quit_item]) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[dsh-desktop] menu failed: {e:?}");
                    return Err(e.into());
                }
            };
            let tray = match TrayIconBuilder::with_id("main")
                .icon(
                    app.default_window_icon()
                        .expect("default window icon should be embedded")
                        .clone(),
                )
                .tooltip("DeepSeek Harness")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "update-check" => {
                        let handle = app.clone();
                        std::thread::spawn(move || run_update_check(handle));
                    }
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)
            {
                Ok(t) => t,
                Err(e) => {
                    eprintln!("[dsh-desktop] tray build failed: {e:?}");
                    return Err(e.into());
                }
            };
            let _ = tray;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭窗口 -> 隐藏到托盘，而不是退出
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            // 保留 dsh web 后台服务（下次启动秒连；如需完全停止：任务管理器结束 node.exe）。
            // 不再 kill 自己拉起的子进程：std 的 Child 被 drop 不会终止进程，
            // 这里显式丢弃句柄即可让服务继续常驻。
            if let Some(state) = app_handle.try_state::<DshServer>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.take() {
                        drop(child);
                    }
                }
            }
        }
    });
}
