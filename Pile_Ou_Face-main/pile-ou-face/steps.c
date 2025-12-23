#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *name;  // rax, rbx, rcx, ...
    int         posi;  // offset (visualisation) en octets, 0 = top
    int         size;  // hauteur (8 par défaut)
    const char *value; // valeur AFFICHÉE en décimal (ex: "1", "10")
} Item;

typedef struct {
    const char *key;   // "1", "2", "3", ...
    const Item *items;
    int         count;
} Group;

#define LEN(a) (int)(sizeof(a)/sizeof((a)[0]))

// ——— Étape 1: mov rax, 1
static const Item STEP1[] = {
    { "rax",  0,  8, "1" },
};
// ——— Étape 2: add rax, 9
static const Item STEP2[] = {
    { "rax",  0,  8, "10" },
};

// ——— Étape 3: mov rcx, rax
static const Item STEP3[] = {
    { "rax",  0,  8, "10" },
    { "rcx", 16,  8, "10" },
};
// ——— Étape 4: imul rax, rcx  (10 * 10)
static const Item STEP4[] = {
    { "rax",  0,  8, "100" },
    { "rcx", 16,  8, "10" },
    };

// ——— Étape 5: mov rbx, rax
static const Item STEP5[] = {
    { "rax",  0,  8, "100" },
    { "rcx", 16,  8, "10" },
    { "rbx", 24,  8, "100" },
    };

// ——— Étape 6: imul rbx, rax  (100 * 100)
static const Item STEP6[] = {
    { "rax",  0,  8, "100" },
    { "rcx", 16,  8, "10" },
    { "rbx", 24,  8, "100" },
    };

static const Group GROUPS[] = {
    { "1", STEP1, LEN(STEP1) },
    { "2", STEP2, LEN(STEP2) },
    { "3", STEP3, LEN(STEP3) },
    { "4", STEP4, LEN(STEP4) },
    { "5", STEP5, LEN(STEP5) },
    { "6", STEP6, LEN(STEP6) },
};

static void print_items_array(const Item *v, int n) {
    putchar('['); putchar('\n');
    for (int i = 0; i < n; ++i) {
        printf("  {\"name\":\"%s\",\"posi\":%d,\"size\":%d,\"value\":\"%s\"}%s\n",
               v[i].name, v[i].posi, v[i].size, v[i].value, (i+1<n)?",":"");
    }
    putchar(']'); putchar('\n');
}

static void print_timeline(const Group *g, int ng) {
    puts("{");
    for (int gi = 0; gi < ng; ++gi) {
        printf("  \"%s\": [\n", g[gi].key);
        for (int i = 0; i < g[gi].count; ++i) {
            const Item *it = &g[gi].items[i];
            printf("    {\"name\":\"%s\",\"posi\":%d,\"size\":%d,\"value\":\"%s\"}%s\n",
                   it->name, it->posi, it->size, it->value,
                   (i+1<g[gi].count)?",":"");
        }
        printf("  ]%s\n", (gi+1<ng)?",":"");
    }
    puts("}");
}

int main(int argc, char **argv) {
    const int total = LEN(GROUPS);  // Nombre total d'étapes

    if (argc >= 2 && strcmp(argv[1], "--count") == 0) {
        printf("%d\n", total);  // Garde ça pour la compatibilité
        return 0;
    }

    if (argc >= 3 && strcmp(argv[1], "--step") == 0) {
        int n = atoi(argv[2]);
        if (n < 1 || n > total) n = 1;
        const Group *g = &GROUPS[n - 1];
        print_items_array(g->items, g->count);  // Retourne un seul snapshot
        return 0;
    }

    // Nouvelle partie : Retourne un tableau complet de tous les snapshots
    printf("[");  // Début du tableau JSON
    for (int i = 0; i < total; i++) {
        const Group *g = &GROUPS[i];
        printf("{\"step\": %d, \"registers\": [", i + 1);  // Snapshot pour l'étape i+1
        for (int j = 0; j < g->count; j++) {
            const Item *it = &g->items[j];
            printf("{\"name\":\"%s\",\"posi\":%d,\"size\":%d,\"value\":\"%s\"}%s",
                   it->name, it->posi, it->size, it->value, (j+1 < g->count ? "," : ""));
        }
        printf("]}%s", (i+1 < total ? "," : ""));  // Fin du snapshot, et virgule si ce n'est pas le dernier
    }
    printf("]\n");  // Fin du tableau JSON
    return 0;
}


