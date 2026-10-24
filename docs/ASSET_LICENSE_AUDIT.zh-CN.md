# 发型许可复核与发布准备记录

核查日期：2026-10-24。对象：LIGHTFIELD 1.1.0 候选版。本记录保存发布前的核查事实；之后的版本状态以 GitHub Release 为准，未授权重写历史。

## 复核结论

原发型确为 Daniel Bystedt 的 Blender Hair Styles Demo。官方发布页、官方演示资源条目和原始文件内的作者声明相互吻合。CC BY-SA 是开放授权，允许依约复制、修改、商业使用及再分发；不应把缺少版本号一概描述为禁止上传，也不需要为许可已经覆盖的行为重复取得授权。

新增证据是 Blender 官方网站的默认内容许可：其“Website Content License”链接明确指向 CC BY-SA 3.0。2023-03-29 的历史页面也保留相同链接。2023-04-03 的发型条目与当前页面均标为 CC-BY-SA，没有写另一版本。

这为“按官网默认 CC BY-SA 3.0 处理该官网提供、同样标为 BY-SA 的下载内容”提供了合理且可追溯的解释依据。因此撤回仅因缺少版本号而对全部原发型作出的笼统排除判断。可以继续准备保留原发型的、供审批的发布候选。

**证据的边界：**原始文件并未逐字写出 3.0，也没有资产专属的版本化许可证链接。站点默认内容条款对该下载文件的适用属于结合上下文的解释，不是作者补充确认。本记录不把这个解释伪装成文件内的事实，更不推定所有未标版本的 CC BY-SA 都属于 3.0。当前一般软件许可页面的简短 Website License 描述又链接 BY 4.0，和专门网站内容条款不完全一致；本案资源自己的 BY-SA 声明、发布当年的网站条款及现行专门条款共同支持 BY-SA 3.0 解释，仍应让发布审批者看到这项范围解释。

## 可追溯证据

| 证据 | 实际结果 |
| --- | --- |
| [Blender 3.5 发布页](https://www.blender.org/download/releases/3-5/) | 作者 Daniel Bystedt；Hair Styles Demo 下载指向 hair_nodes-female_hair_styles.blend |
| [当前官方演示资源页](https://www.blender.org/download/demo-files/#hair) | 发型条目明确标注 CC-BY-SA 和作者；条目 HTML 没有版本化许可链接 |
| [原始下载](https://mirror.blender.org/demo/geometry-nodes/hair_nodes-female_hair_styles.blend) | 28,612,482 字节，文件 SHA-256 见 evidence.json；内置文本 Hair demo file info 包含作者及 CC BY-SA 声明 |
| [官方下载目录](https://download.blender.org/demo/geometry-nodes/) | 同名文件，目录时间 2023-03-28，文件大小与本地原件相符 |
| [网站内容许可](https://www.blender.org/about/website/) | 默认条款的真实链接为 https://creativecommons.org/licenses/by-sa/3.0/；另要求相关艺术作品保留艺术家署名 |
| [2023-03-29 网站条款存档](https://web.archive.org/web/20230329201740/https://www.blender.org/about/website/) | 当时已存在默认 BY-SA 3.0 文字链接及 rel=license 链接 |
| [2023-04-03 发型条目存档](https://web.archive.org/web/20230403112013/https://www.blender.org/download/demo-files/) | 同一下载文件与作者，标为 CC-BY-SA，需 Blender 3.5 |
| [一般软件许可页](https://www.blender.org/about/license/) | Blender 程序的 GPL 与本发型许可是不同对象；其网站许可摘要存在上述不一致，已保留证据而未隐去 |

存档是对官方历史网页的第三方存证，不是第三方自行授予许可。文件检查使用 Blender --disable-autoexec，未执行原件附带脚本；检查文本、资产元数据和相关自定义许可字段，共有 19 个带记录的文本数据块，没有发现针对本发型的 3.0 或 4.0 声明。Blender 文件格式版本是 3.5 系列，不能把软件版本当作 CC 许可证版本。

作者官方作品站的直接抓取返回 403，作者商店的其他毛发工具不是这份发型的补充授权；均未当作版本证据。没有联系作者、登录账号、读取浏览器资料或作出授权承诺。未将同页 Splash Fox 的 3.0、手册的 4.0、程序 GPL 或其他内置节点资源的许可套给这份发型。

## 按现有证据准备的许可安排

1. 署名 **Hair Styles — Daniel Bystedt**，保留官方页面、原始文件链接和原始 CC BY-SA 声明；保留 Blender Foundation / blender.org 的站点署名。
2. 许可清单同时写明“原声明 CC BY-SA，版本处理依据为官网默认 CC BY-SA 3.0”，附上该政策及历史证据，而不是悄悄把原声明改成 3.0 或 4.0。随包提供 BY-SA 3.0 条款文本作为本次处理依据。
3. 说明抽取的曲线对象、重采样、密度调整、发根贴合、发梢裁切、颜色、碰撞及摆动适配；这些发型改编贡献按所采用的 BY-SA 3.0 条款处理，不添加 NC、禁止修改或独占限制。
4. **应用代码继续 MIT**，Three.js 继续 MIT。外置发型数据与独立加载、碰撞代码分别识别；不会把发型 SA 义务自动扩大到整个独立程序，也不会把艺术资源误标成 MIT。
5. 资源文件、浏览器缩略图、文档插图和导出照片分别审查。保存来源署名并不能自动解决两个不同 SA 作品在同一改编作品中的兼容问题。

## 需要分别处理的女性合成内容

[Scifi Girl v.01](https://sketchfab.com/3d-models/scifi-girl-v01-96340701c2ed4d37851c7d9109eee9c0) 的平台官方 API 明确返回 patrix、BY-NC-SA、4.0 许可链接。男性 Man base mesh 的官方 API 返回 BlakkMato、BY、4.0。查询结果的哈希已留存。

女性模型文件独立采用 CC BY-NC-SA 4.0；独立发型文件采用以上 BY-SA 处理依据。**这不意味着两者只要同处一个 ZIP 就必然冲突**：分别、可识别的独立作品可以构成集合，各自保留许可。

但是女性戴该发型的合成预览、烘焙贴图、合并模型、图片和动画可能构成同时改编两个作品的成果。BY-SA 与 BY-NC-SA 不是可随意互换的相同许可证；增加“仅非商业”会限制 BY-SA 许可的自由，而直接把女性作品转为 BY-SA 又会丢失其 NC 条件。[CC 官方 FAQ](https://creativecommons.org/faq/#can-i-combine-material-under-different-creative-commons-licenses-in-my-work)、[2004 年兼容说明](https://creativecommons.org/2004/05/25/announcingandexplainingournew20licenses/)及[兼容许可清单](https://creativecommons.org/compatible-licenses/)没有提供通用的 BY-SA 与 BY-NC-SA 合并许可路径。

本轮完整本地版保留这些个人试验，不把它们宣称为已获清晰公开分发依据的合成作品。公开候选可以保留独立男女模型和独立发型数据，但应先排除女性戴原发型的合成缩略图、演示图和示例照片；女性无附加发型的图片可按女性原许可处理。是否某一具体渲染仅是集合、是否需要双方另行许可，取决于具体成果与适用法律，本次不作一刀切结论。

## 原发型与替代品

原有三个发型及男女切换、碰撞与惯性功能均未删除或替换。

MakeHuman 官方功能资源包另有 Tomáš Klecer 的 Hair editor。官方功能包清单明确为 CC0，指定包页面列出 hair.blend 与 fur.blend，下载压缩包和实际文件已核对及留存哈希，不只依赖平台标签。已导出男女短发、直发和卷发试配，但长发与卷发在截图中仍有不自然的贴合，未达到替代验收要求。它们保留为隔离试验；不以劣化的试配强行取代原发型。

来源：[官方功能包许可](https://static.makehumancommunity.org/assets/assetpacks.html)、[指定 Hair editor 包](https://static.makehumancommunity.org/assets/assetpacks/haireditor.html)。

## 仓库、隐私与发布状态

已实际读取当前 GitHub main 的 4 个可达提交、v1.0.0 的两个 Release ZIP 和 Actions 工件清单。当前已发布的两个 ZIP 未发现本轮三个发型文件或对应原始 blend；CRC 与 SHA-256 已核对。当前 LFS 文件列表为空，Actions 工件数为 0。当前工作流没有毛发下载、缓存恢复或上传测试工件的步骤。没有证据要求为本发型清理已公开历史，因此未执行重写历史、删除 Release 或强制推送。

这是对已核对可达对象、现行附件和查询结果的结论，不声称证明所有不可达服务端对象、分叉或未获访问的缓存均不存在。发布时应从明确列单的候选文件构建，不能把整个工作目录 git add --all，也不能恢复未经核对的 CI 缓存。

早期完整本地候选保留私人合成试验，不作为公开发行包。本次公开版已通过 40 项自动测试、隔离 Chromium 相机验证，以及从 Windows ZIP 完整解压后运行原生启动器的女性照片验证；资源清单、署名与修改记录、文件完整性及隐私扫描均已核对。最终附件仅按公开清单打包，详见 PACKAGE_STATUS.json 与随 Release 提供的 SHA256SUMS.txt。

发布审批应区分：软件功能可用；原发型有真实开放授权及官方默认版本解释依据；女性合成成果仍需单独审查。当前没有把整个完整本地包判定为可直接公开上传，也不再把发型本身判为未经授权或一概不可发布。

如果需要把“官网默认条款适用于该下载”提升为资产专属的无歧义证据，缺少的是作者或 Blender 发布方对**该确切文件**的版本化许可链接/说明，而不是对复制、修改、分发重复授权。若要公开女性与原发型的合成改编，则另需兼容许可依据或足以支持其为集合的具体审查；仅补上发型版本号不能自动解决这点。没有代用户发送询问信息。


## 发布实现：补全照片而不预装合成图片

1.1.0 保留独立女性模型和原发型数据。女性四张照片由软件在使用者本机首次切换时渲染并缓存，不作为合成图片加入仓库、构建产物或 Release。后台渲染使用独立临时场景及图形上下文，完成后释放；主画面像素、姿态、灯光和相机设置保持不变。禁止本地存储时可在本次会话使用。该做法不声称为使用者日后公开分享这些合成作品另行取得授权，相关兼容性边界仍保留。

发布者已获用户在补全女性照片后上传本版的指示。最终附件仅从经审查的源码清单打包，完整私人试验包、原始工程、浏览器数据及本机生成的女性合成图均不上传。
