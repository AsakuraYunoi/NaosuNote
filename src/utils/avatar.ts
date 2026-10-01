import { ref } from 'vue';
import defaultAvatar from '../assets/avatar.png';
import { getServerBaseUrl, getAuthToken } from './api';

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
  return defaultAvatar;
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
