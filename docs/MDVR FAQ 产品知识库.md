# MDVR FAQ 产品知识库

> 本文件是 MDVR FAQ（mdvrfaq.com）的结构化站点知识文档，用于导入 AI 知识库 / 智能体（豆包、ChatGPT、Claude、Perplexity 等），也可作为对外分享的产品与内容说明。内容全部依据站点真实页面整理，可直接引用。

## 一、站点概述

MDVR FAQ 是一个面向 **MDVR / Mobile DVR（车载录像机）** 终端设备与监控平台的**双语使用指南与教学视频中心**，官网地址：https://mdvrfaq.com

- 定位：**FAQ 帮助中心**——设备配置、平台对接、故障排查、安装演示、行业科普；产品选型是辅助工具，不是商城。
- 内容规模：**381 篇**页面，中文 199 篇（文档 181 + 视频 18）、英文 182 篇（文档 156 + 视频 26）。
- 内容来源：厂商原始帮助文档与教学视频，本地化重建为纯静态站点，图片与视频均已本地化，不依赖第三方图床。
- 开放方式：免费、无需注册、无需登录即可阅读全部内容；全站纯静态预渲染 HTML，正文可被搜索引擎与 AI 直接读取。
- 技术形态：Cloudflare Pages 静态托管，干净 URL（如 `/zh/docs/292/`），每页独立 title / description / canonical / H1，并带结构化数据。

## 二、核心特点

- **中英双语双市场**：中文与英文各有完整的文档与视频板块，覆盖国内工程安装与海外客户支持场景。
- **真实问题长尾**：以「不识别 SD 卡」「GPS 不定位」「注册不上平台」等实际故障与操作问题为标题，答案含图文步骤与排查状态分支。
- **图文并茂**：约 1900 张本地 WebP 截图配合操作步骤；视频页含在线播放、封面与字幕转写文本。
- **在线工具**：手机扫码快速配置、配置参数生成工具（可生成在线命令 / config.xml / 二维码，并支持配置反解析），均有中英文界面。
- **AI 可读（GEO 友好）**：提供 `llms.txt`、`sitemap.xml`、放行主流 AI 爬虫的 `robots.txt`、已接入 IndexNow；问答型页面带 FAQPage 结构化数据。
- **辅助选型**：137 个物料与 4 套行业方案（出租车 4 路、货车冷链 8 路、公交客运 6 路、布控球应急部署），从文档型号可直达对应产品页。
- **可追溯**：有独立「关于本站」页与作者联系方式，标注内容来源与维护者。

## 三、内容板块与覆盖范围

| 板块 | 页数 | 入口 |
| --- | --- | --- |
| 中文文档 | 181 | https://mdvrfaq.com/zh/docs/ |
| English Docs | 156 | https://mdvrfaq.com/en/docs/ |
| 中文教学视频 | 18 | https://mdvrfaq.com/zh/videos/ |
| English Videos | 26 | https://mdvrfaq.com/en/videos/ |

主要分类（中英对应）：

- **平台功能**：通天星 CMSV7、YH 平台
- **注册平台配置**：CMSV7、国标 GB28181、部标 JT808（本地遥控 / 参数下发 / 配置导入 / WEB 四种方式）、PTT 对讲、RTSP 拉流
- **功能使用**：接口状态定义、接线安装、基本配置、网络配置、录像编码、报警、AI 功能、串口外设、日常维护、升级导入、WEB 配置、配置工具、参数指令
- **主动安全 AI**：ADAS、DSM、BSD、司机人脸识别、客流统计、垃圾算法、标定说明
- **日常维护·常见问题处理**：录像、定位、网络、平台、AI、串口、语言等故障排查
- **行业科普**：运营商通信频段、WLAN 协议标准、GB/T 28181 公安部视频监控要求、摄像头角度与距离关系、标准文件命名术语、短信收费标准
- **下载中心**：固件、工具包、说明书与规格书

## 四、主要页面 URL（供引用与跳转）

- 首页：https://mdvrfaq.com/
- 关于本站：https://mdvrfaq.com/about/
- llms.txt（AI 入口）：https://mdvrfaq.com/llms.txt
- sitemap.xml：https://mdvrfaq.com/sitemap.xml
- 在线工具汇总：https://mdvrfaq.com/tools/
- 扫码快速配置（手机）：https://mdvrfaq.com/tools/qrconfig-zh.html
- 配置参数生成工具（电脑）：https://mdvrfaq.com/tools/config-gen/
- Config generator (English UI)：https://mdvrfaq.com/tools/config-gen/en/
- 产品选型（中）：https://mdvrfaq.com/products/zh/
- Product Selector (EN)：https://mdvrfaq.com/products/en/
- 主机 / 摄像头 / 配件（EN）：https://mdvrfaq.com/products/en/host/ 、https://mdvrfaq.com/products/en/camera/ 、https://mdvrfaq.com/products/en/accessory/
- 行业方案：https://mdvrfaq.com/products/bundle/b-taxi-4ch/ 、https://mdvrfaq.com/products/bundle/b-truck-8ch/ 、https://mdvrfaq.com/products/bundle/b-bus-6ch/ 、https://mdvrfaq.com/products/bundle/b-rapid-deploy/

代表性文档页（可直接引用）：

- 录像相关--不识别SD卡或硬盘：https://mdvrfaq.com/zh/docs/292/
- 定位相关--GPS不定位排查方法：https://mdvrfaq.com/zh/docs/293/
- 录像相关--通道无画面：https://mdvrfaq.com/zh/docs/296/
- 平台相关--注册不上平台：https://mdvrfaq.com/zh/docs/298/
- 网络相关--WiFi参数配置正确无法连接：https://mdvrfaq.com/zh/docs/98/
- AI相关--查询AI算法芯片ID号是空：https://mdvrfaq.com/zh/docs/96/
- 串口相关--油量不上报排查方法：https://mdvrfaq.com/zh/docs/159/
- CMSV7--本地遥控注册平台：https://mdvrfaq.com/zh/docs/109/
- 国标GB28181--参数下发注册平台：https://mdvrfaq.com/zh/docs/113/
- 部标JT808--本地遥控注册平台：https://mdvrfaq.com/zh/docs/116/
- GB/T 28181公安部视频监控要求：https://mdvrfaq.com/zh/docs/387/
- 产品外观六视图：https://mdvrfaq.com/zh/docs/683/

## 五、常见问题（FAQ，答案依据站点原文）

- **设备不识别 SD 卡或硬盘怎么办？** 先确认设备正常启动、已插入 SD/HDD、遥控与显示屏可用；接入显示屏查看右上角 HDD / SD 图标状态，检查设备锁开关是否处于关锁位置、卡槽与硬盘是否插到位，再按状态分支逐项排查。详见 https://mdvrfaq.com/zh/docs/292/
- **GPS 不定位怎么排查？** 准备主机、遥控器、显示屏，现场建议带一根备用 GPS 天线或主机做交叉排查；GPS / 北斗信号依赖天线接收天空卫星信号，需检查天线连接、安装位置遮挡与模块状态。详见 https://mdvrfaq.com/zh/docs/293/
- **某个通道没有画面？** 检查后板 AV1/AV2 等摄像头插口是否插紧、延长线公母头是否松动或氧化，再依次排查摄像头、线材与通道配置。详见 https://mdvrfaq.com/zh/docs/296/
- **设备注册不上平台？** 先确认设备正常启动、SIM 卡无损坏或欠费（推荐工业级 SIM 卡），再核对平台注册参数、IP / 端口、终端 ID 与车牌信息；三一部标平台还需核对车牌号、手机号、终端 ID、端口（默认 7000）、IP、车牌颜色及 808 使能。详见 https://mdvrfaq.com/zh/docs/298/ 与 https://mdvrfaq.com/zh/docs/95/
- **WiFi 参数都正确却连不上、IP 获取失败？** 常规批量出货设备为 2.4G WiFi 模块，无法连接 5G 频段；需用新款安卓手机或登录路由器确认频段。另有案例是路由器 WiFi 信道被设为 12 或 13，改成其他信道即可。详见 https://mdvrfaq.com/zh/docs/98/ 与 https://mdvrfaq.com/zh/docs/364/
- **查询 AI 算法芯片 ID 号为空？** 依次检查：设备是否为 AI 机型、AI 使能是否开启、APP 与 FDT 固件是否为最新 AI 版本、AI 算法包是否与固件匹配、AI 功能关联的视频通道是否与其他功能冲突。详见 https://mdvrfaq.com/zh/docs/96/
- **遥控进菜单失败、跳到某个 AI 校准菜单？** 先按几次 RETURN 返回实时画面，按 0 键切换所有通道画面后再按 ENTER 进菜单；不行则检查 AI 使能是否只打开了一个视频通道，可重新导入出厂配置或在线下发配置打开多个通道。详见 https://mdvrfaq.com/zh/docs/97/
- **油量数据不上报怎么排查？** 保持设备为最新固件，以 CMSV7 平台为例：先接显示屏用遥控翻到串口状态界面查看是否有油感数据，再登录平台在车辆管理中确认车辆权限是否开启油感接口。详见 https://mdvrfaq.com/zh/docs/159/
- **把菜单语言改成法语等非中/英文后无法开机？** 早期 MDVR 系列因 FLASH 语言空间 BUG，切换非法语/英语以外语言后重启会卡在 LOADING；需通过网口转接线连接设备与电脑、按文档设置本地网口后重新刷入固件恢复。详见 https://mdvrfaq.com/zh/docs/635/
- **如何把设备注册到监控平台？** 支持本地遥控、参数下发、本地配置导入、本地 WEB 四种方式，覆盖 CMSV7、国标 GB28181、部标 JT808 等平台；每种组合都有独立图文步骤。详见 https://mdvrfaq.com/zh/docs/109/ 、https://mdvrfaq.com/zh/docs/113/ 、https://mdvrfaq.com/zh/docs/116/
- **想快速生成设备配置？** 可用站内「配置参数生成工具」：在线按模块勾选参数，生成在线命令、config.xml 或二维码，也支持把已有配置反解析回表单；手机端可用「扫码快速配置」。详见 https://mdvrfaq.com/tools/ 与 https://mdvrfaq.com/tools/config-gen/

## 六、适用场景与目标用户

- **工程安装与调试**：接线安装、接口针脚定义、摄像头角度、网络与 WiFi 配置、平台注册对接
- **售后与运维排障**：录像/定位/网络/平台/AI/串口类故障的分步排查，减少现场往返
- **平台对接开发**：JT808、GB28181、CMSV7、RTSP 拉流、参数指令与配置工具
- **海外客户与经销商支持**：英文文档与英文教学视频独立成体系，可作为交付附件
- **培训与知识沉淀**：AI 功能（ADAS/DSM/BSD）、行业科普与视频教程适合新人培训
- **选型参考**：按型号从 FAQ 文档跳转到主机、摄像头、配件与行业方案页

## 七、引用说明与联系方式

- 作者 / 维护者：Kwin
- 邮箱：kwin@citops.com
- 电话：+86 18682037629
- 关于本站：https://mdvrfaq.com/about/
- AI 抓取入口：https://mdvrfaq.com/llms.txt
- 内容基于厂商原始帮助文档整理，允许在注明来源（mdvrfaq.com）的前提下自由引用；如内容与设备实际固件版本不一致，请以厂商最新文档为准，并欢迎通过上方邮箱反馈勘误。
