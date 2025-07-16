// Lösenordsgenerator för säkra kundlösenord

export interface PasswordOptions {
  length?: number
  includeUppercase?: boolean
  includeLowercase?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
  excludeSimilar?: boolean
}

const defaultOptions: Required<PasswordOptions> = {
  length: 12,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: false, // Enklare för kunder att skriva
  excludeSimilar: true // Utesluter 0, O, l, 1, etc.
}

const charset = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // Utan I, O
  lowercase: 'abcdefghijkmnpqrstuvwxyz', // Utan l, o
  numbers: '23456789', // Utan 0, 1
  symbols: '!@#$%&*+=?',
  similar: '0O1lI' // Tecken att undvika
}

/**
 * Genererar ett säkert lösenord
 */
export function generatePassword(options: PasswordOptions = {}): string {
  const opts = { ...defaultOptions, ...options }
  
  let characters = ''
  let requiredChars = ''
  
  if (opts.includeUppercase) {
    characters += charset.uppercase
    requiredChars += getRandomChar(charset.uppercase)
  }
  
  if (opts.includeLowercase) {
    characters += charset.lowercase
    requiredChars += getRandomChar(charset.lowercase)
  }
  
  if (opts.includeNumbers) {
    characters += charset.numbers
    requiredChars += getRandomChar(charset.numbers)
  }
  
  if (opts.includeSymbols) {
    characters += charset.symbols
    requiredChars += getRandomChar(charset.symbols)
  }
  
  // Generera resten av lösenordet
  const remainingLength = opts.length - requiredChars.length
  let password = requiredChars
  
  for (let i = 0; i < remainingLength; i++) {
    password += getRandomChar(characters)
  }
  
  // Shuffla lösenordet för att undvika mönster
  return shuffleString(password)
}

/**
 * Genererar ett enkelt, uttalbart lösenord (bra för kunder)
 */
export function generateSimplePassword(): string {
  const adjectives = [
    'Blå', 'Röd', 'Grön', 'Gul', 'Vit', 'Svart', 'Stor', 'Liten',
    'Snabb', 'Stark', 'Ljus', 'Mörk', 'Klar', 'Mjuk', 'Hård', 'Fin'
  ]
  
  const nouns = [
    'Hus', 'Bil', 'Båt', 'Katt', 'Hund', 'Fågel', 'Träd', 'Berg',
    'Hav', 'Skog', 'Sten', 'Blomma', 'Sol', 'Måne', 'Stjärna', 'Moln'
  ]
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 100) + 10
  
  return `${adjective}${noun}${number}`
}

/**
 * Genererar ett lösenord baserat på kundens namn
 */
export function generateCustomerPassword(customerName: string): string {
  // Ta första bokstaven från förnamn och efternamn
  const nameParts = customerName.trim().split(' ')
  const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('')
  
  // Lägg till slumpmässiga siffror och tecken
  const numbers = Math.floor(Math.random() * 9000) + 1000 // 4-siffrig kod
  const symbol = ['!', '@', '#', '$', '%'][Math.floor(Math.random() * 5)]
  
  return `${initials}${numbers}${symbol}`
}

// Hjälpfunktioner
function getRandomChar(str: string): string {
  return str.charAt(Math.floor(Math.random() * str.length))
}

function shuffleString(str: string): string {
  const arr = str.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

/**
 * Kontrollerar lösenordsstyrka
 */
export function checkPasswordStrength(password: string): {
  score: number
  feedback: string[]
  strength: 'Svag' | 'Medel' | 'Stark' | 'Mycket stark'
} {
  const feedback: string[] = []
  let score = 0
  
  // Längd
  if (password.length >= 12) score += 2
  else if (password.length >= 8) score += 1
  else feedback.push('Lösenordet bör vara minst 8 tecken långt')
  
  // Stora bokstäver
  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Lägg till stora bokstäver')
  
  // Små bokstäver
  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Lägg till små bokstäver')
  
  // Siffror
  if (/[0-9]/.test(password)) score += 1
  else feedback.push('Lägg till siffror')
  
  // Symboler
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
  else feedback.push('Lägg till symboler för extra säkerhet')
  
  let strength: 'Svag' | 'Medel' | 'Stark' | 'Mycket stark'
  if (score >= 5) strength = 'Mycket stark'
  else if (score >= 4) strength = 'Stark'
  else if (score >= 2) strength = 'Medel'
  else strength = 'Svag'
  
  return { score, feedback, strength }
}
