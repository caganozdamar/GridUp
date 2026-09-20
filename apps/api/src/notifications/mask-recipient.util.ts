// Telefon numarasi kisisel veridir (KVKK); loglara tam yazilmaz. Rakam
// icermeyen etiketler ("Operations Team") oldugu gibi birakilir.
export function maskRecipient(recipient: string): string {
  const digits = recipient.replace(/\D/g, '');
  if (digits.length < 6) return recipient;
  const head = recipient.slice(0, 3);
  const tail = recipient.slice(-2);
  return `${head}${'*'.repeat(Math.max(recipient.length - 5, 3))}${tail}`;
}
