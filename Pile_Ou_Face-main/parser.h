#ifndef PARSER_H
#define PARSER_H

#include <stdio.h>

// Parse un fichier ASM, simule pile + registres,
// et écrit un JSON de tous les "push" sur le flux 'out'.
// Retourne 0 si succes, non-0 si erreur.
int parse_file_to_json(const char* path, FILE* out);

#endif
