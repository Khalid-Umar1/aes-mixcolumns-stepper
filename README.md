# AES MixColumns Stepper

A browser calculator for the **MixColumns** step of AES-192. Give it two hex bytes and it multiplies them in GF(2⁸), showing every shift, overflow, `1B` reduction and XOR along the way.

AES-192 uses exactly the same MixColumns step as AES-128 and AES-256 (only the key schedule and number of rounds differ), so the results apply to all three.

- Field: GF(2⁸)
- Reduction polynomial: m(x) = x⁸ + x⁴ + x³ + x + 1 (`0x11B`)
- Addition: XOR

## Running it

No install or build step. It is a single HTML file.

1. Download or clone this repository:
   ```bash
   git clone https://github.com/Khalid-Umar1/aes-mixcolumns-stepper.git
   ```
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox).

## Step-by-step usage

### Mode 1: Two bytes

Use this to compute a single product such as `02 · D4` or `03 · BF`.

1. Open the **Two bytes** tab (it is selected by default).
2. In **Matrix constant**, type the multiplier, 1–2 hex digits (for example `02` or `03`).
   You can also click a shortcut chip: `01 02 03` for MixColumns, or `09 0B 0D 0E` for InvMixColumns.
3. In **State byte**, type the byte from the AES state (for example `D4`).
4. The **Answer** box updates as you type.
5. Scroll down to read the working:
   1. **Write both bytes in binary and as polynomials.** Example: `D4 = 1101 0100 = x⁷ + x⁶ + x⁴ + x²`.
   2. **Split the constant into powers of x.** Example: `03 = 02 ⊕ 01`, so `03·D4 = (02·D4) ⊕ (01·D4)`.
   3. **Double the byte with xtime.** Each card shows the byte shifted left one bit. If the bit that fell off the left (bit 7) was 1, it is highlighted and the result is XORed with `1B`.
   4. **XOR the needed terms together.** The terms are stacked bit by bit, with the final answer underneath.
   5. **Cross-check by polynomial division.** The same product is computed a second way: polynomial multiplication without carries, then long division by `1 0001 1011`. The remainder must match the answer above.

**Example:** constant `03`, byte `D4`

| Step | Value |
|---|---|
| 02·D4 | D4 = 1101 0100 → shift → 1010 1000, bit 7 was 1 → ⊕ 1B → **B3** |
| 01·D4 | **D4** |
| 03·D4 | B3 ⊕ D4 = **67** |

### Mode 2: Full column

Use this to apply MixColumns to one whole column of the state.

1. Open the **Full column** tab.
2. In **State column**, type the 4 bytes of the column from top to bottom, as 8 hex digits. Spaces are optional: `D4 BF 5D 30` and `D4BF5D30` both work.
3. In **Matrix**, choose:
   - **MixColumns (02 03 01 01)** for encryption, or
   - **InvMixColumns (0E 0B 0D 09)** for decryption.
4. The **New column** box shows the result.
5. Scroll down to read the working:
   1. **Set up the matrix product.** Shows matrix · column = result.
   2. **Rows 0 to 3.** For each output byte you see its formula (for example `s′₀ = 02·D4 ⊕ 03·BF ⊕ 01·5D ⊕ 01·30`), the four products, and the XOR that combines them.
6. Click any product (for example `02·D4 = B3`) to expand its full step-by-step working, the same as in Mode 1.

**Example:** column `D4 BF 5D 30` with MixColumns gives `04 66 81 E5`.
Running `04 66 81 E5` through InvMixColumns gives back `D4 BF 5D 30`.

## Input rules

- Byte fields accept 1–2 hex digits (`0–9`, `A–F`, upper or lower case). A `0x` prefix is allowed.
- The column field needs exactly 8 hex digits.
- If something is invalid, a red message under the inputs tells you what to fix.

## Test values

These match FIPS-197, the AES standard:

| Input | Result |
|---|---|
| `57 · 83` | `C1` |
| `02 · D4` | `B3` |
| `03 · D4` | `67` |
| MixColumns `D4 BF 5D 30` | `04 66 81 E5` |
| MixColumns `DB 13 53 45` | `8E 4D A1 BC` |
