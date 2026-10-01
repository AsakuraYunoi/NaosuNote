import { ref } from 'vue';
import { getServerBaseUrl, getAuthToken } from './api';
// 默认中性极简用户头像矢量图：优雅 Material 风格轮廓，不预设任何特定人物或形象
export const DEFAULT_AVATAR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#avatarGrad)"/>
  <circle cx="64" cy="46" r="22" fill="#FFFFFF" fill-opacity="0.95"/>
  <path d="M25 106 C25 83, 42 75, 64 75 C86 75, 103 83, 103 106 Z" fill="#FFFFFF" fill-opacity="0.95"/>
</svg>
`.trim())}`;

const AVATAR_KEY = 'naosu_user_avatar';
const REMOTE_AVATAR_KEY = 'naosu_user_avatar_remote';

export const userAvatarUrl = ref<string>(loadInitialAvatar());

function loadInitialAvatar(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(AVATAR_KEY);
    if (saved) return saved;

    const remote = localStorage.getItem(REMOTE_AVATAR_KEY);
    if (remote) {
      const baseUrl = getServerBaseUrl();
      return remote.startsWith('http') ? remote : `${baseUrl}${remote}`;
    }
  }
  return DEFAULT_AVATAR_SVG;
}

export function setUserAvatar(url: string) {
  userAvatarUrl.value = url;
  if (typeof window !== 'undefined') {
    localStorage.setItem(AVATAR_KEY, url);
  }
}

export function setRemoteAvatarUrl(remotePath: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REMOTE_AVATAR_KEY, remotePath);
    const baseUrl = getServerBaseUrl();
    const fullUrl = remotePath.startsWith('http') ? remotePath : `${baseUrl}${remotePath}`;
    // 如果没有本地离线 Base64，则使用远程 URL
    if (!localStorage.getItem(AVATAR_KEY)) {
      userAvatarUrl.value = fullUrl;
    }
  }
}

/**
 * 将图片缩放并压缩至 256x256 WebP 格式
 */
export async function compressAvatarToWebp(file: Blob): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const targetDim = 256;
      let { width, height } = img;

      // 居中正方形裁剪计算
      let sx = 0;
      let sy = 0;
      let sDim = Math.min(width, height);

      if (width > height) {
        sx = Math.round((width - height) / 2);
      } else {
        sy = Math.round((height - width) / 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetDim;
      canvas.height = targetDim;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('初始化 Canvas 绘图上下文失败'));
      }

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sDim, sDim, 0, 0, targetDim, targetDim);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('头像压缩失败'));
          const dataUrl = canvas.toDataURL('image/webp', 0.9);
          resolve({ blob, dataUrl });
        },
        'image/webp',
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('读取头像图片失败'));
    };

    img.src = tempUrl;
  });
}

/**
 * 修改并上传用户头像到服务端
 */
export async function apiUploadUserAvatar(file: Blob): Promise<string> {
  const { blob, dataUrl } = await compressAvatarToWebp(file);

  // 1. 本地立即生效（即时响应 UI）
  setUserAvatar(dataUrl);

  // 2. 若已登录，上传至云端服务器
  const token = getAuthToken();
  const baseUrl = getServerBaseUrl();

  if (token) {
    const formData = new FormData();
    formData.append('file', blob, 'avatar.webp');

    const res = await fetch(`${baseUrl}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || json?.code !== 200) {
      console.warn('Upload avatar to cloud failed:', res.status, json);
      throw new Error(json?.message || '头像上传至云端服务器失败');
    }

    const remoteUrl = json.data as string;
    if (remoteUrl) {
      setRemoteAvatarUrl(remoteUrl);
    }
    return remoteUrl;
  }

  return dataUrl;
}
