export function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) * 5280;
}

// Returns a Date object anchored to Black Hills local time (America/Denver)
export function getBlackHillsDate(dateInput = new Date()) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return new Date();
    return new Date(d.toLocaleString('en-US', { timeZone: 'America/Denver' }));
}

// Client-side image validator and WebP resizer/compressor for fast mobile uploads
export async function compressImageToWebP(file, maxDimension = 1200, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file.');
    }
    // Skip compression for animated GIFs or SVGs, or tiny files (< 120KB)
    if (file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size < 120 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file);

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) return resolve(file);
                    const baseName = file.name.replace(/\.[^/.]+$/, '');
                    resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }));
                },
                'image/webp',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}
