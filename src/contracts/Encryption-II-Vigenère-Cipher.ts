/* Encryption II: Vigenère Cipher

Vigenère cipher is a type of polyalphabetic substitution. It uses the
Vigenère square to encrypt and decrypt plaintext with a keyword.

  Vigenère square:
         A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
       +----------------------------------------------------
     A | A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
     B | B C D E F G H I J K L M N O P Q R S T U V W X Y Z A
     C | C D E F G H I J K L M N O P Q R S T U V W X Y Z A B
     D | D E F G H I J K L M N O P Q R S T U V W X Y Z A B C
     E | E F G H I J K L M N O P Q R S T U V W X Y Z A B C D
                ...
     Y | Y Z A B C D E F G H I J K L M N O P Q R S T U V W X
     Z | Z A B C D E F G H I J K L M N O P Q R S T U V W X Y

For encryption each letter of the plaintext is paired with the
corresponding letter of a repeating keyword. For example, the
plaintext DASHBOARD is encrypted with the keyword LINUX:

```
   Plaintext: DASHBOARD
   Keyword:   LINUXLINU
```

So, the first letter D is paired with the first letter of the key
L. Therefore, row D and column L of the Vigenère square are used to
get the first cipher letter O. This must be repeated for the whole
ciphertext.

You are given an array with two elements:
  ["DEBUGCACHEMODEMLOGINARRAY", "HARDWARE"]
The first element is the plaintext, the second element is the keyword.

Return the ciphertext as uppercase string.
 */

import type { NS } from "netscript";
import type { ContractData } from '../contract-locations';

export async function main(ns: NS) {
    let contractDataJSON = ns.args[0];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string argument. Must be a JSON string containing file, host and contract data.');
        return;
    }
    let contractData: ContractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
}
