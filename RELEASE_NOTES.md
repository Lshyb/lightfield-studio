# 光场 LIGHTFIELD v1.0.0

可离线使用的 3D 人像布光工作室，支持伦勃朗光、环形光、分割光和蝴蝶光。

**第一次使用请先阅读仓库的 `docs/USER_GUIDE.zh-CN.md`，同一份详细指南也随离线包提供。**

## 下载哪个文件

- **Windows 64 位普通用户**：下载 `lightfield-studio-v1.0.0-windows-x64.zip`。完整解压后双击 `启动光场.cmd`，无需安装 Node.js，也无需联网或登录。
- **macOS / Linux / 开发者**：下载 `lightfield-studio-v1.0.0-source.zip`，自行安装 Node.js 20+，运行 `node launch.mjs`。
- `SHA256SUMS.txt` 用于校验下载文件。

Windows 便携版双击 `Lightfield.exe` 启动本地服务器，并在默认浏览器打开。使用 Windows 10 / 11 自带的 .NET Framework 4.x，无需 Node.js。保留启动器窗口以继续使用，关闭窗口停止服务。

功能包括三灯调节、可拖动灯位图、三维摄影棚、相机预览、1200 × 1500 JPG 模拟拍摄、照片恢复布光以及 JSON 方案导入导出。

应用代码采用 MIT；三维头部与贴图采用 CC BY 3.0，作者为 Lee Perry-Smith / Infinite-Realities。完整授权随包提供。
