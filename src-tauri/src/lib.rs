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

/// 桌面端自己拉起的 dsh 子进程；如果端口本来就活着则不拉起，也不负责杀掉。
struct DshServer(Mutex<Option<Child>>);

fn port_alive() -> bool {
    TcpStream::connect_timeout(&DSH_ADDR.parse().unwrap(), Duration::from_millis(400)).is_ok()
}

fn wait_for_port(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if port_alive() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(400));
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

fn spawn_dsh() -> Option<Child> {
    // 0) 安装包自带的捆绑运行时（最优先，小白无需安装任何东西）
    if let Some((node, bin_js)) = bundled_runtime() {
        if let Ok(child) = Command::new(&node)
            .arg(&bin_js)
            .arg("web")
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
    let app = tauri::Builder::default()
        .setup(|app| {
            let child = if port_alive() { None } else { spawn_dsh() };
            app.manage(DshServer(Mutex::new(child)));

            let ready = wait_for_port(Duration::from_secs(60));
            eprintln!("[dsh-desktop] dsh port ready: {ready}");

            // 主窗口：直接加载 dsh Web UI
            let win = match WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(DSH_URL.parse().unwrap()),
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

            // 托盘：显示窗口 / 退出
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
            let menu = match Menu::with_items(app, &[&show_item, &quit_item]) {
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
            // 只清理桌面端自己拉起的 dsh 进程
            if let Some(state) = app_handle.try_state::<DshServer>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        }
    });
}
