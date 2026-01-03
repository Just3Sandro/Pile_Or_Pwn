/*
 * asm2json CLI.
 *
 * This binary loads a small ASM-like file and emits a JSON timeline
 * describing stack/register snapshots, used by the frontend.
 */
#include <stdio.h>
#include <string.h>
#include "parser.h"

// Petit binaire CLI :
//   asm2json <input.asm> [output.json]
// Si output absent : écrit sur stdout.
// Print usage for the CLI.
static void usage(const char* prog) {
    fprintf(stderr, "Usage: %s <input.asm> [output.json]\n", prog);
}

int main(int argc, char** argv) {
    if (argc < 2 || argc > 3) {
        usage(argv[0]);
        return 1;
    }

    // Input ASM and optional output file path.
    const char* inp  = argv[1];
    const char* outp = (argc == 3) ? argv[2] : NULL;

    if (outp) {
        FILE* out = fopen(outp, "w");
        if (!out) {
            fprintf(stderr, "Erreur: impossible d'ouvrir '%s' en écriture\n", outp);
            return 1;
        }
        // Parse ASM and write JSON snapshots to the output file.
        int rc = parse_file_to_json(inp, out);
        fclose(out);
        return rc;
    } else {
        // Default to stdout when no output file is provided.
        return parse_file_to_json(inp, stdout);
    }
}
