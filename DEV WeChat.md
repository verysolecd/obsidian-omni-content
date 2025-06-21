开始开发 /获取 Access token
access_token是公众号的全局唯一接口调用凭据，公众号调用各接口时都需使用access_token。开发者需要进行妥善保存。access_token的存储至少要保留512个字符空间。access_token的有效期目前为2个小时，需定时刷新，重复获取将导致上次获取的access_token失效。

公众平台的API调用所需的access_token的使用及生成方式说明：

1、建议公众号开发者使用中控服务器统一获取和刷新access_token，其他业务逻辑服务器所使用的access_token均来自于该中控服务器，不应该各自去刷新，否则容易造成冲突，导致access_token覆盖而影响业务；

2、目前access_token的有效期通过返回的expires_in来传达，目前是7200秒之内的值。中控服务器需要根据这个有效时间提前去刷新新access_token。在刷新过程中，中控服务器可对外继续输出的老access_token，此时公众平台后台会保证在5分钟内，新老access_token都可用，这保证了第三方业务的平滑过渡；

3、access_token的有效时间可能会在未来有调整，所以中控服务器不仅需要内部定时主动刷新，还需要提供被动刷新access_token的接口，这样便于业务服务器在API调用获知access_token已超时的情况下，可以触发access_token的刷新流程。

4、对于可能存在风险的调用，在开发者进行获取 access_token调用时进入风险调用确认流程，需要用户管理员确认后才可以成功获取。具体流程为：

开发者通过某IP发起调用->平台返回错误码[89503]并同时下发模板消息给公众号管理员->公众号管理员确认该IP可以调用->开发者使用该IP再次发起调用->调用成功。

如公众号管理员第一次拒绝该IP调用，用户在1个小时内将无法使用该IP再次发起调用，如公众号管理员多次拒绝该IP调用，该IP将可能长期无法发起调用。平台建议开发者在发起调用前主动与管理员沟通确认调用需求，或请求管理员开启IP白名单功能并将该IP加入IP白名单列表。

公众号和小程序均可以使用AppID和AppSecret调用本接口来获取access_token。AppID和AppSecret可在“微信公众平台-设置与开发--基本配置”页中获得（需要已经成为开发者，且账号没有异常状态）。**调用接口时，请登录“微信公众平台-开发-基本配置”提前将服务器IP地址添加到IP白名单中，点击查看设置方法，否则将无法调用成功。**小程序无需配置IP白名单。

如长期无AppSecret的使用需求，开发者可以使用管理员账号登录公众平台，在“设置与开发-基本配置”中对AppSeceret进行冻结，提高账号的安全性。AppSecret冻结后，开发者无法使用AppSecret获取Access token（接口返回错误码40243），不影响账号基本功能的正常使用，不影响通过第三方授权调用后台接口，不影响云开发调用后台接口。开发者可以随时使用管理员账号登录公众平台，在“设置与开发-基本配置”中对AppSecret进行解冻。

接口调用请求说明

https请求方式: GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET

参数说明

参数	是否必须	说明
grant_type	是	获取access_token填写client_credential
appid	是	第三方用户唯一凭证
secret	是	第三方用户唯一凭证密钥，即appsecret
返回说明

正常情况下，微信会返回下述JSON数据包给公众号：

{"access_token":"ACCESS_TOKEN","expires_in":7200}
参数说明

参数	说明
access_token	获取到的凭证
expires_in	凭证有效时间，单位：秒
错误时微信会返回错误码等信息，JSON数据包示例如下（该示例为AppID无效错误）:

{"errcode":40013,"errmsg":"invalid appid"}
返回码说明

返回码	说明
-1	系统繁忙，此时请开发者稍候再试
0	请求成功
40001	AppSecret错误或者AppSecret不属于这个公众号，请开发者确认AppSecret的正确性
40002	请确保grant_type字段值为client_credential
40164	调用接口的IP地址不在白名单中，请在接口IP白名单中进行设置。
40243	AppSecret已被冻结，请登录MP解冻后再次调用。
89503	此IP调用需要管理员确认,请联系管理员
89501	此IP正在等待管理员确认,请联系管理员
89506	24小时内该IP被管理员拒绝调用两次，24小时内不可再使用该IP调用
89507	1小时内该IP被管理员拒绝调用一次，1小时内不可再使用该IP调用




第二部分： 草稿

开发者可新增常用的素材到草稿箱中进行使用。上传到草稿箱中的素材被群发或发布后，该素材将从草稿箱中移除。新增草稿可在公众平台官网-草稿箱中查看和管理。

接口请求说明
http 请求方式：POST（请使用https协议）https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN

调用示例

{
    "articles": [
        // 图文消息结构
        {
            "article_type":"news",
            "title":TITLE,
            "author":AUTHOR,
            "digest":DIGEST,
            "content":CONTENT,
            "content_source_url":CONTENT_SOURCE_URL,
            "thumb_media_id":THUMB_MEDIA_ID,
            "need_open_comment":0,
            "only_fans_can_comment":0,
            "pic_crop_235_1":X1_Y1_X2_Y2,
            "pic_crop_1_1":X1_Y1_X2_Y2
        },
        // 图片消息结构
        {
            "article_type":"newspic",
            "title":TITLE,
            "content":CONTENT,
            "need_open_comment":0,
            "only_fans_can_comment":0,
            "image_info":{
                "image_list":[
                    {
                        "image_media_id":IMAGE_MEDIA_ID
                    }
                ]
            },
            "cover_info":{
                "crop_percent_list":[
                    {
                        "ratio": "1_1",
                        "x1":"0.166454",
                        "y1":"0",
                        "x2":"0.833545",
                        "y2":"1"
                    }
                    // 如有其他比例的裁剪需求，可继续在此处填写
                ]
            },
            "product_info": {
                "footer_product_info": {
                    "product_key":PRODUCT_KEY
                }
            }
        }
    ]
}
请求参数说明

参数	是否必须	说明
article_type	否	文章类型，分别有图文消息（news）、图片消息（newspic），不填默认为图文消息（news）
title	是	标题
author	否	作者
digest	否	图文消息的摘要，仅有单图文消息才有摘要，多图文此处为空。如果本字段为没有填写，则默认抓取正文前54个字。
content	是	图文消息的具体内容，支持HTML标签，必须少于2万字符，小于1M，且此处会去除JS,涉及图片url必须来源 "上传图文消息内的图片获取URL"接口获取。外部图片url将被过滤。 图片消息则仅支持纯文本和部分特殊功能标签如商品，商品个数不可超过50个
content_source_url	否	图文消息的原文地址，即点击“阅读原文”后的URL
thumb_media_id	是	图文消息的封面图片素材id（必须是永久MediaID）
need_open_comment	否	Uint32 是否打开评论，0不打开(默认)，1打开
only_fans_can_comment	否	Uint32 是否粉丝才可评论，0所有人可评论(默认)，1粉丝才可评论
pic_crop_235_1	否	封面裁剪为2.35:1规格的坐标字段。以原始图片（thumb_media_id）左上角（0,0），右下角（1,1）建立平面坐标系，经过裁剪后的图片，其左上角所在的坐标即为（X1,Y1）,右下角所在的坐标则为（X2,Y2），用分隔符_拼接为X1_Y1_X2_Y2，每个坐标值的精度为不超过小数点后6位数字。示例见下图，图中(X1,Y1) 等于（0.1945,0）,(X2,Y2)等于（1,0.5236），所以请求参数值为0.1945_0_1_0.5236。
pic_crop_1_1	否	封面裁剪为1:1规格的坐标字段，裁剪原理同pic_crop_235_1，裁剪后的图片必须符合规格要求。
image_info	是	图片消息里的图片相关信息，图片数量最多为20张，首张图片即为封面图
image_media_id	是	图片消息里的图片素材id（必须是永久MediaID）
crop_percent_list	否	封面裁剪信息，裁剪比例ratio支持：“1_1”，“16_9”,“2.35_1”。以图片左上角（0,0），右下角（1,1）建立平面坐标系，经过裁剪后的图片，其左上角所在的坐标填入x1，y1参数，右下角所在的坐标填入x2，y2参数
product_info	否	商品相关信息
footer_product_info	否	文末插入商品相关信息
product_key	否	商品key


接口返回说明
{
   "media_id":MEDIA_ID
}
返回参数说明

参数	描述
media_id	上传后的获取标志，长度不固定，但不会超过 128 字符
错误码说明

错误码	错误信息	解决方案
公共错误码	点击查看	
53404	账号已被限制带货能力，请删除商品后重试	
53405	插入商品信息有误，请检查后重试	请检查请求参数是否合法，以及商品状态是否正常
53406	请先开通带货能力	
