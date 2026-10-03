import argon2 from 'argon2'

const options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
}

export const hashPassword = (password: string) => argon2.hash(password, options)
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)
