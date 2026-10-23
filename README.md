# AES Stepper

A browser calculator for AES that shows every step of the working. Run a full **encryption or decryption** with **AES-128, AES-192 or AES-256**, or run **one phase on its own** (Key Expansion, SubBytes, ShiftRows, MixColumns, AddRoundKey), down to a single byte.

| Variant | Key size | Key words (Nk) | Rounds (Nr) | Round keys |
|---|---|---|---|---|
| AES-128 | 16 bytes / 32 hex digits | 4 | 10 | 11 |
| AES-192 | 24 bytes / 48 hex digits | 6 | 12 | 13 |
| AES-256 | 32 bytes / 64 hex digits | 8 | 14 | 15 |

All variants use the same 16-byte block and the same SubBytes, ShiftRows, MixColumns and AddRoundKey. Only the key expansion and the number of rounds differ.

## Running it

No install or build step.

1. Clone the repository:
   ```bash
   git clone https://github.com/Khalid-Umar1/aes-mixcolumns-stepper.git
   ```
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox).

## Input format

- Everything is in **hex**. Spaces, commas, colons and `0x` prefixes are ignored, so `00 11 22 33`, `00112233` and `0x00,0x11,0x22,0x33` all work.
- A **state** or **block** is 16 bytes (32 hex digits). The bytes fill the 4×4 state **column by column**, as in FIPS-197: bytes 0–3 are column 0, bytes 4–7 are column 1, and so on.
- The byte counter next to each label shows how many bytes you have typed. It turns red until the count is right.
- Default values are the FIPS-197 examples, so you can compare every step with the standard.

## The modules

The bar at the top has two groups:

- **Full AES:** Encrypt / Decrypt
- **Single phases:** Key Expansion, SubBytes, ShiftRows, MixColumns, AddRoundKey

Click a module to open it. Results update as you type.

---

### 1. Encrypt / Decrypt (full AES)

Use this to run the whole cipher on one block.

1. Choose **Encrypt** or **Decrypt** under *Operation*.
2. Choose **AES-128**, **AES-192** or **AES-256** under *Variant*.
3. Type the 16-byte **plaintext** (or **ciphertext** when decrypting).
4. Type the **key**. Its length must match the variant (see the table above).
   Click **Load FIPS-197 example** to fill in the standard test key and block for the chosen variant.
5. The result appears in the **Ciphertext** (or **Plaintext**) box.
6. Scroll down to read the working:
   1. **Expand the key.** Lists every round key. **Show full key expansion** opens the Key Expansion module with this key.
   2. **Load the input into the state.** Shows the 4×4 starting state.
   3. **Run the rounds.** One block per round. Each shows the state before and after every operation:
      - Encryption: Round 0 = AddRoundKey. Rounds 1 to Nr−1 = SubBytes → ShiftRows → MixColumns → AddRoundKey. The final round skips MixColumns.
      - Decryption: Round 0 = AddRoundKey with the last round key. Then each round = InvShiftRows → InvSubBytes → AddRoundKey → InvMixColumns. The final round skips InvMixColumns.
      - Click a round's title to open or close it, or use **Open all rounds** / **Close all rounds**.
      - Click **Explain this step** on any operation to open it in its own module, already filled in with that state. There you see the full byte-level working.
   4. **Result.** The final state. If you used the FIPS-197 example, it also confirms the result matches the standard.
7. To check your answer, click **Use result as input**. It switches between encrypt and decrypt, keeps the key, and should give back your original block.

**Example (AES-192, FIPS-197 C.2)**
Key `000102030405060708090a0b0c0d0e0f1011121314151617`
Plaintext `00112233445566778899aabbccddeeff` → Ciphertext `dda97ca4864cdfe06eaf70a0ec0d7191`

---

### 2. Key Expansion

Use this to see how the cipher key becomes the round keys.

1. Choose the **Variant**.
2. Type the **Cipher key** (or click **Load FIPS-197 example key**).
3. Read the steps:
   1. **Parameters:** Nk, Nr, how many words and round keys are produced, and which Rcon values are used.
   2. **Copy the key** into the first Nk words, w[0] to w[Nk−1].
   3. **Generate the remaining words.** One table row per word: temp, RotWord, SubWord, Rcon, temp ⊕ Rcon, w[i−Nk] and w[i].
      - If `i mod Nk = 0`: RotWord, then SubWord, then XOR with Rcon.
      - AES-256 only: if `i mod 8 = 4`, SubWord only.
      - Otherwise temp is used as it is.
   4. **Round keys:** the words grouped 4 at a time. **Use in AddRoundKey** sends a round key to that module.
   5. **Work out one word in detail:** pick any word w[i] from the list to see each byte of RotWord, each S-box lookup in SubWord, the Rcon XOR, and the final XOR, all in binary.

---

### 3. SubBytes / InvSubBytes

1. Choose **SubBytes** or **InvSubBytes** under *Direction*.
2. Choose the input:
   - **Single byte:** type one byte, for example `53`.
   - **Whole state:** type 16 bytes.
3. For a **single byte**, the steps are:
   1. **Table lookup.** The high nibble is the row and the low nibble is the column. The full 16×16 S-box is shown with that row, column and cell highlighted.
   2. **Multiplicative inverse in GF(2⁸)** (SubBytes) or **inverse affine transform** (InvSubBytes). Open **Check** to see the GF(2⁸) multiplication that proves the inverse is right.
   3. **Affine transform** (SubBytes) or **multiplicative inverse** (InvSubBytes), worked bit by bit in a table.
   4. **Result.** Confirms the computed value matches the table.
4. For a **whole state**, you see the before and after grids and a table of all 16 lookups. **Show working** on any row opens that byte in single-byte mode.

**Example:** SubBytes(`53`) = `ED`, because 53⁻¹ = CA and the affine transform of CA is ED.

---

### 4. ShiftRows / InvShiftRows

1. Choose **ShiftRows** or **InvShiftRows**.
2. Type the 16-byte **state**.
3. Read the steps:
   1. **Lay out the state.** Shows which row and column each of the 16 bytes goes to.
   2. **Rotate each row.** Row 0 stays. Rows 1, 2 and 3 move 1, 2 and 3 places (left for ShiftRows, right for InvShiftRows).
   3. **Result.** Before and after grids, with the output read column by column.

---

### 5. MixColumns / InvMixColumns

Choose the input under *Input*:

**Two bytes** (a single GF(2⁸) product, such as `02 · D4`)
1. Type the **Matrix constant** (or click a chip: `01 02 03` for MixColumns, `09 0B 0D 0E` for InvMixColumns).
2. Type the **State byte**.
3. Read the steps:
   1. Both bytes in binary and as polynomials.
   2. The constant split into powers of x, for example `03 = 02 ⊕ 01`.
   3. **xtime** cards: shift left one bit, and if the bit pushed out was 1, XOR with `1B`.
   4. XOR of the needed terms gives the answer.
   5. **Cross-check:** polynomial multiplication, then division by x⁸ + x⁴ + x³ + x + 1 (`11B`), which must give the same answer.

**One column**
1. Choose **MixColumns** or **InvMixColumns** under *Matrix*.
2. Type 4 bytes, for example `D4 BF 5D 30`.
3. You see the matrix product, then one step per output byte with its 4 products. Click any product to see its full working, followed by the XOR that combines them.

**Whole state**
1. Choose the *Matrix*.
2. Type 16 bytes.
3. Each of the 4 columns has its own section with the same working as *One column*.

**Example:** `03 · D4 = 67`, and column `D4 BF 5D 30` → `04 66 81 E5`.

---

### 6. AddRoundKey

1. Type the 16-byte **State**.
2. Type the 16-byte **Round key**. Use the Key Expansion module to get round keys.
3. Read the steps:
   1. State ⊕ round key = result, shown as three grids.
   2. Each of the 16 bytes XORed in binary.

AddRoundKey is its own inverse, so it is the same for encryption and decryption.

## Project structure

```
index.html              page shell, loads the scripts below
css/style.css           styles (light and dark themes)
js/aes-core.js          AES math: GF(2^8), S-box, round operations, key expansion, encrypt/decrypt with full traces
js/render.js            shared HTML builders (state grids, binary XOR tables, GF(2^8) working)
js/app.js               module registry, navigation, "Explain this step" handoff between modules
js/modules/full.js      Encrypt / Decrypt
js/modules/keys.js      Key Expansion
js/modules/subbytes.js  SubBytes / InvSubBytes
js/modules/shiftrows.js ShiftRows / InvShiftRows
js/modules/mixcolumns.js MixColumns / InvMixColumns
js/modules/addroundkey.js AddRoundKey
tests/run-tests.js      checks against FIPS-197 test values
```

Each module registers itself with `App.register(...)`, so a new module only needs a new file in `js/modules/` and a `<script>` tag in `index.html`.

## Tests

`js/aes-core.js` runs in Node as well as the browser. With Node.js installed:

```bash
node tests/run-tests.js
```

It checks GF(2⁸) multiplication, the S-box and inverse S-box, MixColumns, key expansion for all three key sizes (FIPS-197 Appendix A), and full encryption and decryption for AES-128, AES-192 and AES-256 (FIPS-197 Appendices B and C).

## Scope

This tool works on a single 16-byte block. It does not cover block cipher modes such as ECB, CBC or CTR, or padding.
