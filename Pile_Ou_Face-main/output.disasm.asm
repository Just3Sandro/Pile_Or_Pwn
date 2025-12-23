
examples/stack3_64.elf:     file format elf64-x86-64


Disassembly of section .init:

0000000000401000 <_init>:
  401000:	f3 0f 1e fa          	endbr64
  401004:	48 83 ec 08          	sub    rsp,0x8
  401008:	48 8b 05 e9 2f 00 00 	mov    rax,QWORD PTR [rip+0x2fe9]        # 403ff8 <__gmon_start__@Base>
  40100f:	48 85 c0             	test   rax,rax
  401012:	74 02                	je     401016 <_init+0x16>
  401014:	ff d0                	call   rax
  401016:	48 83 c4 08          	add    rsp,0x8
  40101a:	c3                   	ret

Disassembly of section .plt:

0000000000401020 <.plt>:
  401020:	ff 35 92 2f 00 00    	push   QWORD PTR [rip+0x2f92]        # 403fb8 <_GLOBAL_OFFSET_TABLE_+0x8>
  401026:	ff 25 94 2f 00 00    	jmp    QWORD PTR [rip+0x2f94]        # 403fc0 <_GLOBAL_OFFSET_TABLE_+0x10>
  40102c:	0f 1f 40 00          	nop    DWORD PTR [rax+0x0]
  401030:	f3 0f 1e fa          	endbr64
  401034:	68 00 00 00 00       	push   0x0
  401039:	e9 e2 ff ff ff       	jmp    401020 <_init+0x20>
  40103e:	66 90                	xchg   ax,ax
  401040:	f3 0f 1e fa          	endbr64
  401044:	68 01 00 00 00       	push   0x1
  401049:	e9 d2 ff ff ff       	jmp    401020 <_init+0x20>
  40104e:	66 90                	xchg   ax,ax
  401050:	f3 0f 1e fa          	endbr64
  401054:	68 02 00 00 00       	push   0x2
  401059:	e9 c2 ff ff ff       	jmp    401020 <_init+0x20>
  40105e:	66 90                	xchg   ax,ax
  401060:	f3 0f 1e fa          	endbr64
  401064:	68 03 00 00 00       	push   0x3
  401069:	e9 b2 ff ff ff       	jmp    401020 <_init+0x20>
  40106e:	66 90                	xchg   ax,ax
  401070:	f3 0f 1e fa          	endbr64
  401074:	68 04 00 00 00       	push   0x4
  401079:	e9 a2 ff ff ff       	jmp    401020 <_init+0x20>
  40107e:	66 90                	xchg   ax,ax

Disassembly of section .plt.sec:

0000000000401080 <strcpy@plt>:
  401080:	f3 0f 1e fa          	endbr64
  401084:	ff 25 3e 2f 00 00    	jmp    QWORD PTR [rip+0x2f3e]        # 403fc8 <strcpy@GLIBC_2.2.5>
  40108a:	66 0f 1f 44 00 00    	nop    WORD PTR [rax+rax*1+0x0]

0000000000401090 <puts@plt>:
  401090:	f3 0f 1e fa          	endbr64
  401094:	ff 25 36 2f 00 00    	jmp    QWORD PTR [rip+0x2f36]        # 403fd0 <puts@GLIBC_2.2.5>
  40109a:	66 0f 1f 44 00 00    	nop    WORD PTR [rax+rax*1+0x0]

00000000004010a0 <printf@plt>:
  4010a0:	f3 0f 1e fa          	endbr64
  4010a4:	ff 25 2e 2f 00 00    	jmp    QWORD PTR [rip+0x2f2e]        # 403fd8 <printf@GLIBC_2.2.5>
  4010aa:	66 0f 1f 44 00 00    	nop    WORD PTR [rax+rax*1+0x0]

00000000004010b0 <fputs@plt>:
  4010b0:	f3 0f 1e fa          	endbr64
  4010b4:	ff 25 26 2f 00 00    	jmp    QWORD PTR [rip+0x2f26]        # 403fe0 <fputs@GLIBC_2.2.5>
  4010ba:	66 0f 1f 44 00 00    	nop    WORD PTR [rax+rax*1+0x0]

00000000004010c0 <exit@plt>:
  4010c0:	f3 0f 1e fa          	endbr64
  4010c4:	ff 25 1e 2f 00 00    	jmp    QWORD PTR [rip+0x2f1e]        # 403fe8 <exit@GLIBC_2.2.5>
  4010ca:	66 0f 1f 44 00 00    	nop    WORD PTR [rax+rax*1+0x0]

Disassembly of section .text:

00000000004010d0 <_start>:
  4010d0:	f3 0f 1e fa          	endbr64
  4010d4:	31 ed                	xor    ebp,ebp
  4010d6:	49 89 d1             	mov    r9,rdx
  4010d9:	5e                   	pop    rsi
  4010da:	48 89 e2             	mov    rdx,rsp
  4010dd:	48 83 e4 f0          	and    rsp,0xfffffffffffffff0
  4010e1:	50                   	push   rax
  4010e2:	54                   	push   rsp
  4010e3:	45 31 c0             	xor    r8d,r8d
  4010e6:	31 c9                	xor    ecx,ecx
  4010e8:	48 c7 c7 e9 11 40 00 	mov    rdi,0x4011e9
  4010ef:	ff 15 fb 2e 00 00    	call   QWORD PTR [rip+0x2efb]        # 403ff0 <__libc_start_main@GLIBC_2.34>
  4010f5:	f4                   	hlt
  4010f6:	66 2e 0f 1f 84 00 00 	cs nop WORD PTR [rax+rax*1+0x0]
  4010fd:	00 00 00 

0000000000401100 <_dl_relocate_static_pie>:
  401100:	f3 0f 1e fa          	endbr64
  401104:	c3                   	ret
  401105:	66 2e 0f 1f 84 00 00 	cs nop WORD PTR [rax+rax*1+0x0]
  40110c:	00 00 00 
  40110f:	90                   	nop
  401110:	b8 10 40 40 00       	mov    eax,0x404010
  401115:	48 3d 10 40 40 00    	cmp    rax,0x404010
  40111b:	74 13                	je     401130 <_dl_relocate_static_pie+0x30>
  40111d:	b8 00 00 00 00       	mov    eax,0x0
  401122:	48 85 c0             	test   rax,rax
  401125:	74 09                	je     401130 <_dl_relocate_static_pie+0x30>
  401127:	bf 10 40 40 00       	mov    edi,0x404010
  40112c:	ff e0                	jmp    rax
  40112e:	66 90                	xchg   ax,ax
  401130:	c3                   	ret
  401131:	66 66 2e 0f 1f 84 00 	data16 cs nop WORD PTR [rax+rax*1+0x0]
  401138:	00 00 00 00 
  40113c:	0f 1f 40 00          	nop    DWORD PTR [rax+0x0]
  401140:	be 10 40 40 00       	mov    esi,0x404010
  401145:	48 81 ee 10 40 40 00 	sub    rsi,0x404010
  40114c:	48 89 f0             	mov    rax,rsi
  40114f:	48 c1 ee 3f          	shr    rsi,0x3f
  401153:	48 c1 f8 03          	sar    rax,0x3
  401157:	48 01 c6             	add    rsi,rax
  40115a:	48 d1 fe             	sar    rsi,1
  40115d:	74 11                	je     401170 <_dl_relocate_static_pie+0x70>
  40115f:	b8 00 00 00 00       	mov    eax,0x0
  401164:	48 85 c0             	test   rax,rax
  401167:	74 07                	je     401170 <_dl_relocate_static_pie+0x70>
  401169:	bf 10 40 40 00       	mov    edi,0x404010
  40116e:	ff e0                	jmp    rax
  401170:	c3                   	ret
  401171:	66 66 2e 0f 1f 84 00 	data16 cs nop WORD PTR [rax+rax*1+0x0]
  401178:	00 00 00 00 
  40117c:	0f 1f 40 00          	nop    DWORD PTR [rax+0x0]
  401180:	f3 0f 1e fa          	endbr64
  401184:	80 3d 9d 2e 00 00 00 	cmp    BYTE PTR [rip+0x2e9d],0x0        # 404028 <stderr@GLIBC_2.2.5+0x8>
  40118b:	75 13                	jne    4011a0 <_dl_relocate_static_pie+0xa0>
  40118d:	55                   	push   rbp
  40118e:	48 89 e5             	mov    rbp,rsp
  401191:	e8 7a ff ff ff       	call   401110 <_dl_relocate_static_pie+0x10>
  401196:	c6 05 8b 2e 00 00 01 	mov    BYTE PTR [rip+0x2e8b],0x1        # 404028 <stderr@GLIBC_2.2.5+0x8>
  40119d:	5d                   	pop    rbp
  40119e:	c3                   	ret
  40119f:	90                   	nop
  4011a0:	c3                   	ret
  4011a1:	66 66 2e 0f 1f 84 00 	data16 cs nop WORD PTR [rax+rax*1+0x0]
  4011a8:	00 00 00 00 
  4011ac:	0f 1f 40 00          	nop    DWORD PTR [rax+0x0]
  4011b0:	f3 0f 1e fa          	endbr64
  4011b4:	eb 8a                	jmp    401140 <_dl_relocate_static_pie+0x40>

00000000004011b6 <err>:
  4011b6:	f3 0f 1e fa          	endbr64
  4011ba:	55                   	push   rbp
  4011bb:	48 89 e5             	mov    rbp,rsp
  4011be:	48 83 ec 10          	sub    rsp,0x10
  4011c2:	89 7d fc             	mov    DWORD PTR [rbp-0x4],edi
  4011c5:	48 89 75 f0          	mov    QWORD PTR [rbp-0x10],rsi
  4011c9:	48 8b 15 50 2e 00 00 	mov    rdx,QWORD PTR [rip+0x2e50]        # 404020 <stderr@GLIBC_2.2.5>
  4011d0:	48 8b 45 f0          	mov    rax,QWORD PTR [rbp-0x10]
  4011d4:	48 89 d6             	mov    rsi,rdx
  4011d7:	48 89 c7             	mov    rdi,rax
  4011da:	e8 d1 fe ff ff       	call   4010b0 <fputs@plt>
  4011df:	8b 45 fc             	mov    eax,DWORD PTR [rbp-0x4]
  4011e2:	89 c7                	mov    edi,eax
  4011e4:	e8 d7 fe ff ff       	call   4010c0 <exit@plt>

00000000004011e9 <main>:
  4011e9:	f3 0f 1e fa          	endbr64
  4011ed:	55                   	push   rbp
  4011ee:	48 89 e5             	mov    rbp,rsp
  4011f1:	48 83 ec 60          	sub    rsp,0x60
  4011f5:	89 7d ac             	mov    DWORD PTR [rbp-0x54],edi
  4011f8:	48 89 75 a0          	mov    QWORD PTR [rbp-0x60],rsi
  4011fc:	83 7d ac 01          	cmp    DWORD PTR [rbp-0x54],0x1
  401200:	75 14                	jne    401216 <main+0x2d>
  401202:	48 8d 05 ff 0d 00 00 	lea    rax,[rip+0xdff]        # 402008 <_IO_stdin_used+0x8>
  401209:	48 89 c6             	mov    rsi,rax
  40120c:	bf 01 00 00 00       	mov    edi,0x1
  401211:	e8 a0 ff ff ff       	call   4011b6 <err>
  401216:	c7 45 fc 00 00 00 00 	mov    DWORD PTR [rbp-0x4],0x0
  40121d:	48 8b 45 a0          	mov    rax,QWORD PTR [rbp-0x60]
  401221:	48 83 c0 08          	add    rax,0x8
  401225:	48 8b 10             	mov    rdx,QWORD PTR [rax]
  401228:	48 8d 45 b0          	lea    rax,[rbp-0x50]
  40122c:	48 89 d6             	mov    rsi,rdx
  40122f:	48 89 c7             	mov    rdi,rax
  401232:	e8 49 fe ff ff       	call   401080 <strcpy@plt>
  401237:	8b 45 fc             	mov    eax,DWORD PTR [rbp-0x4]
  40123a:	3d 64 63 62 61       	cmp    eax,0x61626364
  40123f:	75 11                	jne    401252 <main+0x69>
  401241:	48 8d 05 e0 0d 00 00 	lea    rax,[rip+0xde0]        # 402028 <_IO_stdin_used+0x28>
  401248:	48 89 c7             	mov    rdi,rax
  40124b:	e8 40 fe ff ff       	call   401090 <puts@plt>
  401250:	eb 19                	jmp    40126b <main+0x82>
  401252:	8b 45 fc             	mov    eax,DWORD PTR [rbp-0x4]
  401255:	89 c6                	mov    esi,eax
  401257:	48 8d 05 01 0e 00 00 	lea    rax,[rip+0xe01]        # 40205f <_IO_stdin_used+0x5f>
  40125e:	48 89 c7             	mov    rdi,rax
  401261:	b8 00 00 00 00       	mov    eax,0x0
  401266:	e8 35 fe ff ff       	call   4010a0 <printf@plt>
  40126b:	b8 00 00 00 00       	mov    eax,0x0
  401270:	c9                   	leave
  401271:	c3                   	ret

Disassembly of section .fini:

0000000000401274 <_fini>:
  401274:	f3 0f 1e fa          	endbr64
  401278:	48 83 ec 08          	sub    rsp,0x8
  40127c:	48 83 c4 08          	add    rsp,0x8
  401280:	c3                   	ret
