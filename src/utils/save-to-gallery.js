import { registerPlugin } from '@capacitor/core'

const SaveToGallery = registerPlugin('SaveToGallery', {
  web: () => import('./save-to-gallery-web').then(m => new m.SaveToGalleryWeb())
})

export default SaveToGallery
