#include <stdio.h>
#include <string.h>
#include "parser.h"

// Petit binaire CLI :
//   asm2json <input.asm> [output.json]
// Si output absent : écrit sur stdout.
static void usage(const char* prog) {
    fprintf(stderr, "Usage: %s <input.asm> [output.json]\n", prog);
}

int main(int argc, char** argv) {
    if (argc < 2 || argc > 3) {
        usage(argv[0]);
        return 1;
    }

    const char* inp  = argv[1];
    const char* outp = (argc == 3) ? argv[2] : NULL;

    if (outp) {
        FILE* out = fopen(outp, "w");
        if (!out) {
            fprintf(stderr, "Erreur: impossible d'ouvrir '%s' en écriture\n", outp);
            return 1;
        }
        int rc = parse_file_to_json(inp, out);
        fclose(out);
        return rc;
    } else {
        return parse_file_to_json(inp, stdout);
    }
}
