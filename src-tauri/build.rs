fn main() {
    #[cfg(target_os = "macos")]
    {
        let src_m = std::path::Path::new("../platforms/macos/native/html2pdf.m");
        let out_dir = std::path::Path::new("../platforms/macos/bin");
        if src_m.exists() {
            let _ = std::fs::create_dir_all(out_dir);
            let out_bin = out_dir.join("html2pdf");
            let _ = std::process::Command::new("clang")
                .args([
                    "-O2",
                    "-framework",
                    "Foundation",
                    "-framework",
                    "AppKit",
                    "-framework",
                    "WebKit",
                    "-framework",
                    "PDFKit",
                    "-fobjc-arc",
                    src_m.to_str().unwrap(),
                    "-o",
                    out_bin.to_str().unwrap(),
                ])
                .status();
        }
    }
    tauri_build::build();
}
