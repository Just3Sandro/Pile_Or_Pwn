/*
 * Register file model used by the ASM simulator.
 */
#ifndef REGS_H
#define REGS_H

#include <stdint.h>
#include <stdbool.h>

#define REG_COUNT 16

typedef struct {
    const char* name;
    int64_t     value;
} Reg;

typedef struct {
    Reg regs[REG_COUNT];
} RegFile;

// Initialize register names and values.
void        regs_init(RegFile* rf);
// Read a register by name.
bool        regs_get(const RegFile* rf, const char* name, int64_t* out);
// Write a register by name.
bool        regs_set(RegFile* rf, const char* name, int64_t value);
// Return number of registers.
int         regs_count(const RegFile* rf);
// Access a register by index.
const Reg*  regs_at(const RegFile* rf, int index);
// Resolve a name to an index.
int         reg_index(const RegFile* rf, const char* name);

#endif
