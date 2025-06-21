import {getBlobArrayBuffer, requestUrl, RequestUrlParam} from "obsidian";
import {NMPSettings	} from "./settings";

// 获取token
export async function wxGetToken() {
	const settings = NMPSettings.getInstance();
	const appid = settings.wxAppId;
	const secret = settings.wxSecret;

	// 直接调用微信官方API获取token
	const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;

	try {
		const res = await requestUrl({
			url,
			method: 'GET',
			throw: false
		});
		
		if (res.status !== 200) {
			throw new Error(`HTTP error! status: ${res.status}`);
		}
		
		return res;
	} catch (error) {
		console.error('获取微信Token失败:', error);
		new Notice('获取微信Token失败，请检查网络连接和AppID/Secret配置');
		return { error: '获取微信Token失败' };
	}
}


export async function wxKeyInfo(authkey: string) {
	const url = 'https://obplugin.sunboshi.tech/wx/info/' + authkey;
	const res = await requestUrl({
		url: url,
		method: 'GET',
		throw: false,
		contentType: 'application/json',
	});
	return res
}

// 上传图片
export async function wxUploadImage(data: Blob, filename: string, type?: string) {
	const settings = NMPSettings.getInstance();
	const token = settings.wxToken;
	let url = '';
	if (type == null || type === '') {
		url = 'https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=' + token;
	} else {
		url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=${type}`
	}

	const N = 16 // The length of our random boundry string
	const randomBoundryString = "djmangoBoundry" + Array(N + 1).join((Math.random().toString(36) + '00000000000000000').slice(2, 18)).slice(0, N)

	// Construct the form data payload as a string
	const pre_string = `------${randomBoundryString}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: "application/octet-stream"\r\n\r\n`;
	const post_string = `\r\n------${randomBoundryString}--`

	// Convert the form data payload to a blob by concatenating the pre_string, the file data, and the post_string, and then return the blob as an array buffer
	const pre_string_encoded = new TextEncoder().encode(pre_string);
	// const data = file;
	const post_string_encoded = new TextEncoder().encode(post_string);
	const concatenated = await new Blob([pre_string_encoded, await getBlobArrayBuffer(data), post_string_encoded]).arrayBuffer()

	// Now that we have the form data payload as an array buffer, we can pass it to requestURL
	// We also need to set the content type to multipart/form-data and pass in the boundry string
	const options: RequestUrlParam = {
		method: 'POST',
		url: url,
		contentType: `multipart/form-data; boundary=----${randomBoundryString}`,
		body: concatenated
	};

	const res = await requestUrl(options);
	const resData = await res.json;
	return {
		url: resData.url || '',
		media_id: resData.media_id || '',
		errcode: resData.errcode || 0,
		errmsg: resData.errmsg || '',
	}
}

// 新建草稿
export interface DraftArticle {
	title: string;
	author?: string;
	digest?: string;
	cover?: string;
	content: string;
	content_source_url?: string;
	thumb_media_id: string;
	need_open_comment?: number;
	only_fans_can_comment?: number;
	pic_crop_235_1?: string;
	pic_crop_1_1?: string;
}

export async function wxAddDraft(data: DraftArticle) {
  const settings = NMPSettings.getInstance();
  const token = settings.wxToken;
	const url = 'https://api.weixin.qq.com/cgi-bin/draft/add?access_token=' + token;
	const body = {
		articles: [{
			title: data.title,
			content: data.content,
			digest: data.digest,
			thumb_media_id: data.thumb_media_id,
			...data.pic_crop_235_1 && {pic_crop_235_1: data.pic_crop_235_1},
			...data.pic_crop_1_1 && {pic_crop_1_1: data.pic_crop_1_1},
			...data.content_source_url && {content_source_url: data.content_source_url},
			...data.need_open_comment !== undefined && {need_open_comment: data.need_open_comment},
			...data.only_fans_can_comment !== undefined && {only_fans_can_comment: data.only_fans_can_comment},
			...data.author && {author: data.author},
		}]
	};

	const res = await requestUrl({
		method: 'POST',
		url: url,
		throw: false,
		body: JSON.stringify(body)
	});

	return res;
}

export async function wxBatchGetMaterial(token: string, type: string, offset: number = 0, count: number = 10) {
	const url = 'https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=' + token;
	const body = {
		type,
		offset,
		count
	};

	const res = await requestUrl({
		method: 'POST',
		url: url,
		throw: false,
		body: JSON.stringify(body)
	});

	return await res.json;
}