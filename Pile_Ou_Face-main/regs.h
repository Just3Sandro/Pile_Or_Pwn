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

void        regs_init(RegFile* rf);
bool        regs_get(const RegFile* rf, const char* name, int64_t* out);
bool        regs_set(RegFile* rf, const char* name, int64_t value);
int         regs_count(const RegFile* rf);
const Reg*  regs_at(const RegFile* rf, int index);
int         reg_index(const RegFile* rf, const char* name);

#endif
