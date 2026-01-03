section .text
global _start

_start:
    mov rax, 10      ; 1. Charge la valeur 10 dans rax
    push rax         ; 2. Empile rax (Pile : [10])
    mov rbx, 20      ; 3. Charge la valeur 20 dans rbx
    push rbx         ; 4. Empile rbx (Pile : [10, 20])
    pop rcx          ; 5. Dépile le sommet dans rcx (rcx=20, Pile : [10])
    add rax, rcx     ; 6. rax = rax + rcx (10 + 20 = 30)
    push rax         ; 7. Empile le résultat (Pile : [10, 30])
    mov rdx, 50      ; 8. Charge 50 dans rdx
    push rdx         ; 9. Empile rdx (Pile : [10, 30, 50])
    push 100         ; 10. Empile la constante 100 (Pile : [10, 30, 50, 100])
