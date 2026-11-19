#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    error::Error,
    fs,
    io::{self, BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{
    path::BaseDirectory, webview::NewWindowResponse, Manager, RunEvent, Url, WebviewUrl,
    WebviewWindowBuilder,
};

struct Backend(Child);

impl Drop for Backend {
    fn drop(&mut self) {
        drop(self.0.stdin.take());
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn is_external_offer(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.username().is_empty()
        && url.password().is_none()
        && match url.host_str() {
            Some("localhost" | "127.0.0.1" | "[::1]") | None => false,
            Some(_) => true,
        }
}

fn open_external_offer(url: &Url) {
    if is_external_offer(url) {
        let address = url.as_str().to_owned();
        std::thread::spawn(move || {
            if let Err(error) = open::that(address) {
                eprintln!("No se pudo abrir la oferta en el navegador: {error}");
            }
        });
    }
}

fn launch(app: &mut tauri::App) -> Result<(), Box<dyn Error>> {
    let runtime = app
        .path()
        .resolve("desktop-runtime", BaseDirectory::Resource)?;
    let directory = app.path().app_local_data_dir()?;
    fs::create_dir_all(&directory)?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let node = runtime
        .join("bin")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let mut command = Command::new(node);
    command
        .args(["server/index.mjs", "--production"])
        .current_dir(&runtime)
        .env("PORT", "0")
        .env("DB_PATH", directory.join("brujula.sqlite"))
        .env("BRUJULA_SOURCES_FILE", directory.join("fuentes.env"))
        .env("BRUJULA_DESKTOP_TOKEN", &token)
        .env_remove("NODE_OPTIONS")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut backend = Backend(command.spawn()?);
    let stdout = backend
        .0
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("No se pudo iniciar el servicio local"))?;
    let (sender, receiver) = mpsc::sync_channel(1);
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(port) = line
                .strip_prefix("BRUJULA_READY:")
                .and_then(|port| port.parse::<u16>().ok())
            {
                let _ = sender.send(port);
                break;
            }
        }
    });
    let port = receiver
        .recv_timeout(Duration::from_secs(15))
        .map_err(|_| io::Error::other("El servicio local no pudo iniciar"))?;
    let address = format!("http://127.0.0.1:{port}/desktop-session?token={token}").parse()?;
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(address))
        .title("Brújula Empleo")
        .inner_size(1180.0, 810.0)
        .min_inner_size(420.0, 550.0)
        .initialization_script("window.__BRUJULA_DESKTOP__ = true;")
        .on_navigation(move |url| {
            let is_app = url.scheme() == "http"
                && url.host_str() == Some("127.0.0.1")
                && url.port() == Some(port);
            if !is_app {
                open_external_offer(url);
            }
            is_app
        })
        .on_new_window(|url, _| {
            open_external_offer(&url);
            NewWindowResponse::Deny
        })
        .build()?;
    app.manage(Mutex::new(Some(backend)));
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .setup(launch)
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar Brújula Empleo");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(backend) = handle.try_state::<Mutex<Option<Backend>>>() {
                if let Ok(mut slot) = backend.lock() {
                    drop(slot.take());
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_only_external_http_offer_urls() {
        assert!(is_external_offer(
            &Url::parse("https://www.kd.tech/careers/example?id=42#role").unwrap()
        ));
        assert!(!is_external_offer(
            &Url::parse("http://127.0.0.1:5173/api/profile").unwrap()
        ));
        assert!(!is_external_offer(
            &Url::parse("file:///etc/hosts").unwrap()
        ));
        assert!(!is_external_offer(
            &Url::parse("https://user:pass@example.com").unwrap()
        ));
    }
}
