# 光场 LIGHTFIELD 1.1.0

扩展为包含十一种布光方法、六堂原理练习、男女头肩人像和完整相机控制的离线摄影棚。

- 女性四张真实发型照片已补全：首次切换女性时在本机生成并缓存，断网可用，刷新复用；男女切换不会串图。后台生成不改变主画面参数，完成后释放临时图形资源。
- 男女模型、原发型、发色、颈部姿态、胡须和发梢惯性保留；修复颈肩局部形体、裁切开口和变形法线。
- 相机支持 12 种画幅与自定义、12–300 mm 焦距、传感器、0.2–50 m 距离、四个参考点，以及固定机位 / 保持构图两种模式。
- 快门支持 30 s–1/8000 s；当前引擎没有真实运动模糊，该开关明确不可用，快门不虚假改变亮度。
- 保存方案、JPG、A/B 对照、按具体情况回应的观察提示和完整离线指南。

40 项测试及真实浏览器验证通过；覆盖女性照片生成、缓存、受限存储、男女切换、主画面像素一致和临时 GPU 上下文释放。软件不包含独立进行中的原生 Blender 工程，不声称已完成那些工程的全部物理性能验收。

## 下载与使用

1. Windows 10 / 11 64 位用户下载 **lightfield-studio-v1.1.0-windows-x64.zip**。
2. 右键“全部解压”，保留完整文件夹，双击 **Lightfield.exe**。无需 Node.js、Blender 或 npm install；首次启动也可断网使用。
3. 运行期间保留启动器窗口。首次切女性时等待四张发型照片逐张出现，再点击卡片观察。
4. 源码用户安装 Node.js 20+，运行 **node launch.mjs**，没有 npm 依赖。

[详细新手指南](https://github.com/Lshyb/lightfield-studio/blob/main/docs/USER_GUIDE.zh-CN.md) · [相机使用说明](https://github.com/Lshyb/lightfield-studio/blob/main/docs/CAMERA_GUIDE.zh-CN.md)

## 第三方资源与照片

独立代码 MIT。男性模型及胡须 CC BY 4.0；女性模型 CC BY-NC-SA 4.0。原发型的真实声明为 CC BY-SA；按 Blender 官网默认内容许可及 2023 年历史条款，以 BY-SA 3.0 作为明确披露的分发解释依据，原文件本身未写出版本。作者署名、来源、修改记录与解释边界随包保留，没有把该许可扩大至独立代码。

女性与原发型的组合照片仅在使用者本机生成和缓存，不预装合成照片。另行公开分享组合图片仍需审查相同方式共享的兼容性，不能仅加“非商业”字样便认定满足全部条件。

[第三方许可](https://github.com/Lshyb/lightfield-studio/blob/main/THIRD-PARTY.md) · [许可核查记录](https://github.com/Lshyb/lightfield-studio/blob/main/docs/ASSET_LICENSE_AUDIT.zh-CN.md)
