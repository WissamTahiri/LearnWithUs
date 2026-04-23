/* Tests unitaires des helpers backend.
   Exécution : npm test  (utilise le test runner natif de Node 18+). */

const test   = require('node:test')
const assert = require('node:assert')

const {
  genererReferenceTransaction,
  estAdminEmail,
  validerMotDePasse,
  parserAdminEmails
} = require('../utils')


/* ========== genererReferenceTransaction ========== */

test('genererReferenceTransaction — format attendu TXN-YYYYMMDD-HHMMSS', () => {
  const ref = genererReferenceTransaction(new Date('2026-04-22T14:35:22Z'))
  assert.strictEqual(ref, 'TXN-20260422-143522')
})

test('genererReferenceTransaction — sans argument utilise la date du jour', () => {
  const ref = genererReferenceTransaction()
  assert.match(ref, /^TXN-\d{8}-\d{6}$/)
})


/* ========== estAdminEmail ========== */

test('estAdminEmail — renvoie true si email dans la liste', () => {
  assert.strictEqual(
    estAdminEmail('wisstahiri91@gmail.com', ['wisstahiri91@gmail.com', 'autre@test.com']),
    true
  )
})

test('estAdminEmail — insensible à la casse', () => {
  assert.strictEqual(
    estAdminEmail('Admin@LearnWithUs.fr', ['admin@learnwithus.fr']),
    true
  )
})

test('estAdminEmail — renvoie false si liste vide', () => {
  assert.strictEqual(estAdminEmail('test@test.com', []), false)
})

test('estAdminEmail — renvoie false si email inconnu', () => {
  assert.strictEqual(
    estAdminEmail('inconnu@test.com', ['admin@learnwithus.fr']),
    false
  )
})


/* ========== validerMotDePasse ========== */

test('validerMotDePasse — rejette un mdp trop court', () => {
  const r = validerMotDePasse('abc123')
  assert.strictEqual(r.valide, false)
})

test('validerMotDePasse — rejette un mdp vide', () => {
  const r = validerMotDePasse('')
  assert.strictEqual(r.valide, false)
})

test('validerMotDePasse — accepte un mdp de 8 caractères pile', () => {
  const r = validerMotDePasse('Motdepas')
  assert.strictEqual(r.valide, true)
})

test('validerMotDePasse — accepte un mdp long', () => {
  const r = validerMotDePasse('MonSuperMotDePasse123!')
  assert.strictEqual(r.valide, true)
})


/* ========== parserAdminEmails ========== */

test('parserAdminEmails — parse correctement une liste propre', () => {
  const liste = parserAdminEmails('a@test.com,b@test.com,c@test.com')
  assert.deepStrictEqual(liste, ['a@test.com', 'b@test.com', 'c@test.com'])
})

test('parserAdminEmails — supprime les espaces et la casse', () => {
  const liste = parserAdminEmails('  Admin@Test.com ,  Autre@test.COM  ')
  assert.deepStrictEqual(liste, ['admin@test.com', 'autre@test.com'])
})

test('parserAdminEmails — renvoie tableau vide si entrée vide', () => {
  assert.deepStrictEqual(parserAdminEmails(''), [])
  assert.deepStrictEqual(parserAdminEmails(null), [])
  assert.deepStrictEqual(parserAdminEmails(undefined), [])
})

test('parserAdminEmails — ignore les entrées vides entre virgules', () => {
  const liste = parserAdminEmails('a@test.com,,b@test.com, ,c@test.com')
  assert.deepStrictEqual(liste, ['a@test.com', 'b@test.com', 'c@test.com'])
})
