#include "parser.h"
#include "utils.h"
#include "stack.h"
#include "regs.h"
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

#define MAX_LINE 256
#define MAX_TOK  8

typedef struct {
    char instr[MAX_LINE];
    char toks[MAX_TOK][32];
    int  ntok;
    int  lineNumber;
} Instruction;

typedef struct {
    char name[32];
    int  target;
} Label;

static bool ensure_instruction_capacity(Instruction** program,
                                        int* capacity,
                                        int needed) {
    if (*capacity >= needed) {
        return true;
    }
    int new_capacity = (*capacity == 0) ? 64 : *capacity;
    while (new_capacity < needed) {
        new_capacity *= 2;
    }
    Instruction* tmp = realloc(*program, new_capacity * sizeof(Instruction));
    if (!tmp) {
        fprintf(stderr, "Erreur: manque de mémoire pour les instructions\n");
        return false;
    }
    *program  = tmp;
    *capacity = new_capacity;
    return true;
}

static bool ensure_label_capacity(Label** labels, int* capacity, int needed) {
    if (*capacity >= needed) {
        return true;
    }
    int new_capacity = (*capacity == 0) ? 32 : *capacity;
    while (new_capacity < needed) {
        new_capacity *= 2;
    }
    Label* tmp = realloc(*labels, new_capacity * sizeof(Label));
    if (!tmp) {
        fprintf(stderr, "Erreur: manque de mémoire pour les labels\n");
        return false;
    }
    *labels   = tmp;
    *capacity = new_capacity;
    return true;
}

static int label_index(const Label* labels, int nlabels, const char* name) {
    if (!labels || !name) {
        return -1;
    }
    for (int i = 0; i < nlabels; ++i) {
        if (strcmp(labels[i].name, name) == 0) {
            return i;
        }
    }
    return -1;
}

static bool add_label(Label** labels,
                      int* nlabels,
                      int* capacity,
                      const char* name,
                      int target) {
    if (!name || name[0] == '\0') {
        fprintf(stderr, "Erreur: nom de label invalide\n");
        return false;
    }
    if (label_index(*labels, *nlabels, name) >= 0) {
        fprintf(stderr, "Erreur: label déjà défini: '%s'\n", name);
        return false;
    }
    if (!ensure_label_capacity(labels, capacity, *nlabels + 1)) {
        return false;
    }
    Label* entry = &(*labels)[*nlabels];
    strncpy(entry->name, name, sizeof(entry->name) - 1);
    entry->name[sizeof(entry->name) - 1] = '\0';
    entry->target = target;
    (*nlabels)++;
    return true;
}

static int label_target(const Label* labels, int nlabels, const char* name) {
    int idx = label_index(labels, nlabels, name);
    if (idx < 0) {
        return -1;
    }
    return labels[idx].target;
}

static bool is_label_token(const char* tok) {
    if (!tok) return false;
    size_t len = strlen(tok);
    return (len > 0 && tok[len - 1] == ':');
}

// Dump de l'état complet (pile + registres) pour un step donné
static void dump_state(FILE* out,
                       int step,
                       const char* instr,
                       int line,
                       const Stack* stack,
                       const RegFile* regs) {
    if (step > 1) {
        fprintf(out, ",\n");
    }

    fprintf(out, "  {\"step\":%d,\"instr\":\"%s\",\"line\":%d,", step, instr ? instr : "", line);

    // Pile
    fprintf(out, "\"stack\":[");
    for (int i = 0; i < stack->sp; ++i) {
        if (i > 0) fprintf(out, ",");
        const StackEntry* e = &stack->data[i];
        fprintf(out,
                "{\"id\":%d,\"pos\":%d,\"size\":%d,\"value\":%lld}",
                e->id,
                i,
                e->size,
                (long long)e->value);
    }
    fprintf(out, "],");

    // Registres
    fprintf(out, "\"registers\":[");
    int nregs = regs_count(regs);
    for (int i = 0; i < nregs; ++i) {
        if (i > 0) fprintf(out, ",");
        const Reg* r = regs_at(regs, i);
        fprintf(out,
                "{\"name\":\"%s\",\"pos\":%d,\"size\":8,\"value\":%lld}",
                r->name,
                i,
                (long long)r->value);
    }
    fprintf(out, "]}");
}

// Récupère la valeur d'un opérande (reg ou imm)
static bool get_operand_value(const RegFile* regs,
                              const char* tok,
                              int64_t* out) {
    // D'abord essayer comme registre
    if (regs_get(regs, tok, out)) {
        return true;
    }
    // Sinon, immédiat
    if (parse_int64(tok, out)) {
        return true;
    }
    return false;
}

int parse_file_to_json(const char* input_path, FILE* out) {
    FILE* f = fopen(input_path, "r");
    if (!f) {
        fprintf(stderr, "Erreur: impossible d'ouvrir '%s' en lecture\n", input_path);
        return 1;
    }

    Stack   stack;
    RegFile regs;
    stack_init(&stack);
    regs_init(&regs);

    Instruction* program         = NULL;
    int          program_count   = 0;
    int          program_cap     = 0;
    Label*       labels          = NULL;
    int          label_count     = 0;
    int          label_cap       = 0;
    int          rc              = 0;

    fprintf(out, "[\n");

    char line[MAX_LINE];
    int  lineNumber = 0;

    while (fgets(line, sizeof(line), f)) {
        lineNumber++;
        trim_line(line);
        if (line[0] == '\0') continue; // ligne vide ou commentaire

        // On garde une copie pour le champ "instr"
        char instr_text[MAX_LINE];
        snprintf(instr_text, sizeof(instr_text), "%s", line);

        // Tokenisation (modifie line → on travaille sur une copie)
        char work[MAX_LINE];
        strncpy(work, line, sizeof(work) - 1);
        work[sizeof(work) - 1] = '\0';

        char toks[MAX_TOK][32];
        int  ntok = tokenize(work, toks, MAX_TOK);
        if (ntok == 0) continue;

        int tok_index = 0;
        while (tok_index < ntok && is_label_token(toks[tok_index])) {
            size_t len = strlen(toks[tok_index]);
            if (len <= 1) {
                fprintf(stderr, "Erreur: label invalide à la ligne %d\n", lineNumber);
                rc = 1;
                goto cleanup;
            }
            char label_name[32];
            size_t copy_len = len - 1;
            if (copy_len >= sizeof(label_name)) {
                copy_len = sizeof(label_name) - 1;
            }
            memcpy(label_name, toks[tok_index], copy_len);
            label_name[copy_len] = '\0';
            if (!add_label(&labels, &label_count, &label_cap, label_name, program_count)) {
                rc = 1;
                goto end;
            }
            tok_index++;
        }

        if (tok_index >= ntok) {
            continue; // ligne qui ne contient que des labels
        }

        if (!ensure_instruction_capacity(&program, &program_cap, program_count + 1)) {
            rc = 1;
            goto end;
        }

        Instruction* inst = &program[program_count];
        strncpy(inst->instr, instr_text, sizeof(inst->instr) - 1);
        inst->instr[sizeof(inst->instr) - 1] = '\0';
        inst->lineNumber = lineNumber;
        inst->ntok       = ntok - tok_index;
        for (int i = 0; i < inst->ntok; ++i) {
            strncpy(inst->toks[i], toks[tok_index + i], sizeof(inst->toks[i]) - 1);
            inst->toks[i][sizeof(inst->toks[i]) - 1] = '\0';
        }
        program_count++;
    }

    fclose(f);
    f = NULL;

    int  step      = 0;
    int  pc        = 0;
    bool zero_flag = false;
    while (pc >= 0 && pc < program_count) {
        Instruction* inst = &program[pc];
        const char*  op   = inst->toks[0];
        bool         handled = false;
        bool         jumped  = false;

        // --- MOV ---
        if (strcmp(op, "mov") == 0 && inst->ntok >= 3) {
            const char* dst = inst->toks[1];
            const char* src = inst->toks[2];

            int64_t val = 0;
            if (!get_operand_value(&regs, src, &val)) {
                fprintf(stderr, "Erreur: opérande invalide pour mov: '%s'\n", src);
            } else if (!regs_set(&regs, dst, val)) {
                fprintf(stderr, "Erreur: registre destination invalide pour mov: '%s'\n", dst);
            } else {
                handled = true;
            }
        }
        // --- PUSH ---
        else if (strcmp(op, "push") == 0 && inst->ntok >= 2) {
            int64_t val = 0;
            if (!get_operand_value(&regs, inst->toks[1], &val)) {
                fprintf(stderr, "Erreur: opérande invalide pour push: '%s'\n", inst->toks[1]);
            } else if (!stack_push(&stack, val)) {
                // message déjà affiché par stack_push
            } else {
                handled = true;
            }
        }
        // --- POP ---
        else if (strcmp(op, "pop") == 0) {
            int64_t val = 0;
            if (!stack_pop(&stack, &val)) {
                // message déjà affiché par stack_pop
            } else {
                if (inst->ntok >= 2) {
                    if (!regs_set(&regs, inst->toks[1], val)) {
                        fprintf(stderr, "Erreur: registre invalide pour pop: '%s'\n", inst->toks[1]);
                    }
                }
                handled = true;
            }
        }
        // --- ADD / SUB / MUL / DIV sur la pile (aucun argument) ---
        else if ((strcmp(op, "add") == 0 ||
                  strcmp(op, "sub") == 0 ||
                  strcmp(op, "mul") == 0 ||
                  strcmp(op, "div") == 0) &&
                 inst->ntok == 1) {
            int64_t a, b, res;

            if (!stack_pop(&stack, &b) || !stack_pop(&stack, &a)) {
                fprintf(stderr, "Erreur: pile insuffisante pour %s\n", op);
            } else {
                if (strcmp(op, "add") == 0) {
                    res = a + b;
                } else if (strcmp(op, "sub") == 0) {
                    res = a - b;
                } else if (strcmp(op, "mul") == 0) {
                    res = a * b;
                } else { // div
                    if (b == 0) {
                        fprintf(stderr, "Erreur: division par zéro\n");
                        goto after_op;
                    }
                    res = a / b;
                }

                if (!stack_push(&stack, res)) {
                    // message d'erreur déjà affiché
                } else {
                    handled = true;
                }
            }
        }
        // --- ADD / SUB / MUL / DIV sur registres (dst, src) ---
        else if ((strcmp(op, "add") == 0 ||
                  strcmp(op, "sub") == 0 ||
                  strcmp(op, "mul") == 0 ||
                  strcmp(op, "div") == 0) &&
                 inst->ntok >= 3) {
            const char* dst = inst->toks[1];
            const char* src = inst->toks[2];
            int64_t dst_val = 0;
            int64_t src_val = 0;
            int64_t res     = 0;

            if (!regs_get(&regs, dst, &dst_val)) {
                fprintf(stderr, "Erreur: registre destination invalide pour %s: '%s'\n", op, dst);
            } else if (!get_operand_value(&regs, src, &src_val)) {
                fprintf(stderr, "Erreur: opérande invalide pour %s: '%s'\n", op, src);
            } else {
                if (strcmp(op, "add") == 0) {
                    res = dst_val + src_val;
                } else if (strcmp(op, "sub") == 0) {
                    res = dst_val - src_val;
                } else if (strcmp(op, "mul") == 0) {
                    res = dst_val * src_val;
                } else { // div
                    if (src_val == 0) {
                        fprintf(stderr, "Erreur: division par zéro\n");
                        goto after_op;
                    }
                    res = dst_val / src_val;
                }

                if (!regs_set(&regs, dst, res)) {
                    fprintf(stderr, "Erreur: impossible d'écrire dans '%s'\n", dst);
                } else {
                    handled = true;
                }
            }
        }
        // --- JMP ---
        else if (strcmp(op, "jmp") == 0 && inst->ntok >= 2) {
            int target = label_target(labels, label_count, inst->toks[1]);
            if (target < 0) {
                fprintf(stderr, "Erreur: label inconnu pour jmp: '%s'\n", inst->toks[1]);
            } else {
                pc     = target;
                jumped = true;
            }
        }
        // --- LOOP ---
        else if (strcmp(op, "loop") == 0 && inst->ntok >= 2) {
            int64_t rcx_val = 0;
            if (!regs_get(&regs, "rcx", &rcx_val)) {
                fprintf(stderr, "Erreur: registre rcx introuvable pour loop\n");
            } else {
                rcx_val -= 1;
                regs_set(&regs, "rcx", rcx_val);
                int target = label_target(labels, label_count, inst->toks[1]);
                if (target < 0) {
                    fprintf(stderr, "Erreur: label inconnu pour loop: '%s'\n", inst->toks[1]);
                } else if (rcx_val != 0) {
                    pc     = target;
                    jumped = true;
                }
                handled = true; // rcx est toujours modifié
            }
        }
        // --- CMP ---
        else if (strcmp(op, "cmp") == 0 && inst->ntok >= 3) {
            int64_t lhs = 0;
            int64_t rhs = 0;
            if (!get_operand_value(&regs, inst->toks[1], &lhs)) {
                fprintf(stderr, "Erreur: opérande invalide pour cmp: '%s'\n", inst->toks[1]);
            } else if (!get_operand_value(&regs, inst->toks[2], &rhs)) {
                fprintf(stderr, "Erreur: opérande invalide pour cmp: '%s'\n", inst->toks[2]);
            } else {
                zero_flag = (lhs == rhs);
                handled   = true;
            }
        }
        // --- JE (jump if equal) ---
        else if (strcmp(op, "je") == 0 && inst->ntok >= 2) {
            if (zero_flag) {
                int target = label_target(labels, label_count, inst->toks[1]);
                if (target < 0) {
                    fprintf(stderr, "Erreur: label inconnu pour je: '%s'\n", inst->toks[1]);
                } else {
                    pc     = target;
                    jumped = true;
                }
            }
        }
        // Autres opcodes : ignorés silencieusement
        else {
            // noop pour ce format
        }

after_op:
        if (!jumped) {
            pc++;
        }
        if (handled) {
            step++;
            dump_state(out, step, inst->instr, inst->lineNumber, &stack, &regs);
        }
    }

end:
    fprintf(out, "\n]\n");

cleanup:
    if (f) fclose(f);
    free(program);
    free(labels);
    return rc;
}
