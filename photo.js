/** Downscale a photo in the browser so uploads stay small on mobile data. Returns a JPEG data URL. */
export function shrinkPhoto(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => reject(new Error('Could not read that image. Try another photo.'))
    img.src = URL.createObjectURL(file)
  })
}
