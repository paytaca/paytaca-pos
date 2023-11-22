import { getKeypair, savePrivkey, updatePubkey, generateKeypair, sha256 } from './keys'


export async function updateOrCreateKeypair() {
  const keypair = await getKeypair()
    .catch(error => {
      console.error(error)
      return { privkey: '', pubkey: '' }
    })

  if (!keypair?.privkey) {
    const newKeypair = generateKeypair()
    keypair.privkey = newKeypair.privkey
    keypair.pubkey = newKeypair.pubkey

    await savePrivkey(keypair.privkey)
      .then(success => success || Promise.reject())
      .catch(() => Promise.reject('Failed to save privkey locally'))
  }
  await updatePubkey(keypair.pubkey)
    .catch(error => {
      console.error(error)
      return Promise.reject('Failed to save pubkey to server')
    })

  return keypair
}

export {
  sha256,
}
