/**
 * Contrôle de cohérence entre le type MIME déclaré par le navigateur et les
 * premiers octets réellement transmis.
 *
 * Pourquoi : `file.type` vient du client et se falsifie en une ligne. Le bucket
 * Storage applique déjà une liste blanche de types, mais il se fonde sur ce même
 * type déclaré. Un exécutable renommé en `.png` passerait donc. La vérification
 * ci-dessous ne prouve pas l'innocuité du fichier, elle constate seulement que
 * la signature ne contredit pas le type annoncé.
 *
 * Le téléchargement force par ailleurs `Content-Disposition: attachment` : un
 * fichier déposé n'est jamais rendu comme une page dans l'origine du service.
 */

/** Nombre d'octets nécessaires au contrôle. */
export const SIGNATURE_SAMPLE_BYTES = 16;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

const ZIP_LOCAL_FILE = [0x50, 0x4b, 0x03, 0x04];
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];
const OLE_COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

/**
 * `true` si les premiers octets sont compatibles avec le type annoncé.
 *
 * Les formats texte n'ont pas de signature : on vérifie seulement qu'aucun
 * octet nul n'apparaît dans l'échantillon, ce qui trahit un binaire renommé.
 */
export function signatureMatchesMimeType(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  switch (mimeType) {
    case "application/pdf":
      return startsWith(bytes, PDF);
    case "image/png":
      return startsWith(bytes, PNG);
    case "image/jpeg":
      return startsWith(bytes, JPEG);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return startsWith(bytes, ZIP_LOCAL_FILE) || startsWith(bytes, ZIP_EMPTY);
    case "application/msword":
      return startsWith(bytes, OLE_COMPOUND);
    case "text/plain":
    case "text/csv":
      return !bytes.includes(0x00);
    default:
      // Type hors liste blanche : le schéma Zod l'a déjà refusé en amont.
      return false;
  }
}
