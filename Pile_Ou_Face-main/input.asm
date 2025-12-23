; ------------------------------------------------------
; input_add_jmp_loop.asm — tests arithmétiques + jmp + loop
; Hypothèses:
;   - push <imm/reg> empile une valeur
;   - pop  <reg>     dépile dans un registre
;   - add/sub/mul/div:
;       dépilent 2 valeurs: (a = second) (b = top)
;       poussent le résultat: a (+,-,*,/) b
;   - loop <label> décrémente RCX puis saute si RCX != 0
; ------------------------------------------------------

jmp start

; ------------------------------------------------------
; 1) Somme 1..N avec LOOP
;    Accumulateur sur la pile
;    N dans RCX (utilisé par LOOP)
; ------------------------------------------------------
start:
    mov rcx, 10          ; N = 10
    push 0               ; acc = 0 sur la pile

sum_loop:
    ; acc = acc + rcx
    push rcx             ; empile i
    add                  ; acc + i

    loop sum_loop        ; rcx-- ; si rcx != 0 -> sum_loop

    ; résultat attendu: 55
    pop rdi              ; rdi = 55 (somme 1..10)

    ; on continue vers la suite
    jmp chain_tests


; ------------------------------------------------------
; 2) Boucle avec JMP conditionnel (factoriel simple)
;    factoriel de 6 : 6*5*4*3*2*1 = 720
;    - RAX = acc
;    - RBX = i
; ------------------------------------------------------
chain_tests:
    mov rax, 1           ; acc = 1
    mov rbx, 6           ; i = 6

fact_loop:
    ; acc = acc * i  (via pile)
    push rax
    push rbx
    mul
    pop rax              ; rax = rax * rbx

    ; i--
    sub rbx, 1

    ; si i == 0 -> sortie, sinon boucle
    cmp rbx, 0
    je  fact_done
    jmp fact_loop

fact_done:
    ; résultat attendu: rax = 720

    ; on passe à un test division avec gestion "div0"
    jmp div_tests


; ------------------------------------------------------
; 3) Division entière avec branchement vers erreur si diviseur = 0
;    Test: 40 / 3 = 13 ; puis 64 / 8 = 8 ; puis tentative /0
; ------------------------------------------------------
div_tests:
    ; 40 / 3
    push 40
    push 3
    div
    pop r8               ; r8 = 13

    ; 64 / 8
    push 64
    push 8
    div
    pop r9               ; r9 = 8

    ; tentative 10 / 0 -> on branche AVANT d'appeler div
    mov rdx, 0           ; diviseur
    cmp rdx, 0
    je  div_zero

    push 10
    push rdx
    div
    jmp end_program


div_zero:
    ; Ici, tu mets ce que ton environnement supporte:
    ; - message d'erreur
    ; - code retour
    ; - snapshot spécifique
    ;
    ; Exemple: on pose un "code erreur" dans r15
    mov r15, -1
    jmp end_program


; ------------------------------------------------------
; Fin
; ------------------------------------------------------
end_program:
    ; (optionnel) regrouper / sauvegarder des résultats
    ; rdi = somme 1..10 (=55)
    ; rax = 6! (=720)
    ; r8  = 40/3 (=13)
    ; r9  = 64/8 (=8)
    ; r15 = -1 si division par zéro détectée
    ; fin
