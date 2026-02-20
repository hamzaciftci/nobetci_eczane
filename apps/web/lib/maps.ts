export function toGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function toAppleMapsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?ll=${lat},${lng}`;
}

export function toOsmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
