
examples/stack3.elf:     file format elf32-i386


Disassembly of section .init:

08049000 <_init>:
 8049000:	53                   	push   ebx
 8049001:	83 ec 08             	sub    esp,0x8
 8049004:	e8 a7 00 00 00       	call   80490b0 <__x86.get_pc_thunk.bx>
 8049009:	81 c3 eb 2f 00 00    	add    ebx,0x2feb
 804900f:	8b 83 f8 ff ff ff    	mov    eax,DWORD PTR [ebx-0x8]
 8049015:	85 c0                	test   eax,eax
 8049017:	74 02                	je     804901b <_init+0x1b>
 8049019:	ff d0                	call   eax
 804901b:	83 c4 08             	add    esp,0x8
 804901e:	5b                   	pop    ebx
 804901f:	c3                   	ret

Disassembly of section .plt:

08049020 <__libc_start_main@plt-0x10>:
 8049020:	ff 35 f8 bf 04 08    	push   DWORD PTR ds:0x804bff8
 8049026:	ff 25 fc bf 04 08    	jmp    DWORD PTR ds:0x804bffc
 804902c:	00 00                	add    BYTE PTR [eax],al
	...

08049030 <__libc_start_main@plt>:
 8049030:	ff 25 00 c0 04 08    	jmp    DWORD PTR ds:0x804c000
 8049036:	68 00 00 00 00       	push   0x0
 804903b:	e9 e0 ff ff ff       	jmp    8049020 <_init+0x20>

08049040 <printf@plt>:
 8049040:	ff 25 04 c0 04 08    	jmp    DWORD PTR ds:0x804c004
 8049046:	68 08 00 00 00       	push   0x8
 804904b:	e9 d0 ff ff ff       	jmp    8049020 <_init+0x20>

08049050 <puts@plt>:
 8049050:	ff 25 08 c0 04 08    	jmp    DWORD PTR ds:0x804c008
 8049056:	68 10 00 00 00       	push   0x10
 804905b:	e9 c0 ff ff ff       	jmp    8049020 <_init+0x20>

Disassembly of section .text:

08049060 <_start>:
 8049060:	31 ed                	xor    ebp,ebp
 8049062:	5e                   	pop    esi
 8049063:	89 e1                	mov    ecx,esp
 8049065:	83 e4 f0             	and    esp,0xfffffff0
 8049068:	50                   	push   eax
 8049069:	54                   	push   esp
 804906a:	52                   	push   edx
 804906b:	e8 19 00 00 00       	call   8049089 <_start+0x29>
 8049070:	81 c3 84 2f 00 00    	add    ebx,0x2f84
 8049076:	6a 00                	push   0x0
 8049078:	6a 00                	push   0x0
 804907a:	51                   	push   ecx
 804907b:	56                   	push   esi
 804907c:	8d 83 99 d0 ff ff    	lea    eax,[ebx-0x2f67]
 8049082:	50                   	push   eax
 8049083:	e8 a8 ff ff ff       	call   8049030 <__libc_start_main@plt>
 8049088:	f4                   	hlt
 8049089:	8b 1c 24             	mov    ebx,DWORD PTR [esp]
 804908c:	c3                   	ret
 804908d:	e9 3d 01 00 00       	jmp    80491cf <main>
 8049092:	66 90                	xchg   ax,ax
 8049094:	66 90                	xchg   ax,ax
 8049096:	66 90                	xchg   ax,ax
 8049098:	66 90                	xchg   ax,ax
 804909a:	66 90                	xchg   ax,ax
 804909c:	66 90                	xchg   ax,ax
 804909e:	66 90                	xchg   ax,ax

080490a0 <_dl_relocate_static_pie>:
 80490a0:	f3 0f 1e fb          	endbr32
 80490a4:	c3                   	ret
 80490a5:	66 90                	xchg   ax,ax
 80490a7:	66 90                	xchg   ax,ax
 80490a9:	66 90                	xchg   ax,ax
 80490ab:	66 90                	xchg   ax,ax
 80490ad:	66 90                	xchg   ax,ax
 80490af:	90                   	nop

080490b0 <__x86.get_pc_thunk.bx>:
 80490b0:	8b 1c 24             	mov    ebx,DWORD PTR [esp]
 80490b3:	c3                   	ret
 80490b4:	66 90                	xchg   ax,ax
 80490b6:	66 90                	xchg   ax,ax
 80490b8:	66 90                	xchg   ax,ax
 80490ba:	66 90                	xchg   ax,ax
 80490bc:	66 90                	xchg   ax,ax
 80490be:	66 90                	xchg   ax,ax
 80490c0:	b8 14 c0 04 08       	mov    eax,0x804c014
 80490c5:	3d 14 c0 04 08       	cmp    eax,0x804c014
 80490ca:	74 24                	je     80490f0 <__x86.get_pc_thunk.bx+0x40>
 80490cc:	8b 05 e8 bf 04 08    	mov    eax,DWORD PTR ds:0x804bfe8
 80490d2:	85 c0                	test   eax,eax
 80490d4:	74 1a                	je     80490f0 <__x86.get_pc_thunk.bx+0x40>
 80490d6:	55                   	push   ebp
 80490d7:	89 e5                	mov    ebp,esp
 80490d9:	83 ec 14             	sub    esp,0x14
 80490dc:	68 14 c0 04 08       	push   0x804c014
 80490e1:	ff d0                	call   eax
 80490e3:	83 c4 10             	add    esp,0x10
 80490e6:	c9                   	leave
 80490e7:	c3                   	ret
 80490e8:	2e 8d b4 26 00 00 00 	lea    esi,cs:[esi+eiz*1+0x0]
 80490ef:	00 
 80490f0:	c3                   	ret
 80490f1:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 80490f8:	2e 8d b4 26 00 00 00 	lea    esi,cs:[esi+eiz*1+0x0]
 80490ff:	00 
 8049100:	b8 14 c0 04 08       	mov    eax,0x804c014
 8049105:	2d 14 c0 04 08       	sub    eax,0x804c014
 804910a:	89 c2                	mov    edx,eax
 804910c:	c1 e8 1f             	shr    eax,0x1f
 804910f:	c1 fa 02             	sar    edx,0x2
 8049112:	01 d0                	add    eax,edx
 8049114:	d1 f8                	sar    eax,1
 8049116:	74 20                	je     8049138 <__x86.get_pc_thunk.bx+0x88>
 8049118:	8b 15 f0 bf 04 08    	mov    edx,DWORD PTR ds:0x804bff0
 804911e:	85 d2                	test   edx,edx
 8049120:	74 16                	je     8049138 <__x86.get_pc_thunk.bx+0x88>
 8049122:	55                   	push   ebp
 8049123:	89 e5                	mov    ebp,esp
 8049125:	83 ec 10             	sub    esp,0x10
 8049128:	50                   	push   eax
 8049129:	68 14 c0 04 08       	push   0x804c014
 804912e:	ff d2                	call   edx
 8049130:	83 c4 10             	add    esp,0x10
 8049133:	c9                   	leave
 8049134:	c3                   	ret
 8049135:	8d 76 00             	lea    esi,[esi+0x0]
 8049138:	c3                   	ret
 8049139:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049140:	f3 0f 1e fb          	endbr32
 8049144:	80 3d 14 c0 04 08 00 	cmp    BYTE PTR ds:0x804c014,0x0
 804914b:	75 1b                	jne    8049168 <__x86.get_pc_thunk.bx+0xb8>
 804914d:	55                   	push   ebp
 804914e:	89 e5                	mov    ebp,esp
 8049150:	83 ec 08             	sub    esp,0x8
 8049153:	e8 68 ff ff ff       	call   80490c0 <__x86.get_pc_thunk.bx+0x10>
 8049158:	c6 05 14 c0 04 08 01 	mov    BYTE PTR ds:0x804c014,0x1
 804915f:	c9                   	leave
 8049160:	c3                   	ret
 8049161:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049168:	c3                   	ret
 8049169:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049170:	f3 0f 1e fb          	endbr32
 8049174:	eb 8a                	jmp    8049100 <__x86.get_pc_thunk.bx+0x50>

08049176 <win>:
 8049176:	55                   	push   ebp
 8049177:	89 e5                	mov    ebp,esp
 8049179:	53                   	push   ebx
 804917a:	83 ec 04             	sub    esp,0x4
 804917d:	e8 ba 00 00 00       	call   804923c <__x86.get_pc_thunk.ax>
 8049182:	05 72 2e 00 00       	add    eax,0x2e72
 8049187:	83 ec 0c             	sub    esp,0xc
 804918a:	8d 90 14 e0 ff ff    	lea    edx,[eax-0x1fec]
 8049190:	52                   	push   edx
 8049191:	89 c3                	mov    ebx,eax
 8049193:	e8 b8 fe ff ff       	call   8049050 <puts@plt>
 8049198:	83 c4 10             	add    esp,0x10
 804919b:	90                   	nop
 804919c:	8b 5d fc             	mov    ebx,DWORD PTR [ebp-0x4]
 804919f:	c9                   	leave
 80491a0:	c3                   	ret

080491a1 <sys_read>:
 80491a1:	55                   	push   ebp
 80491a2:	89 e5                	mov    ebp,esp
 80491a4:	53                   	push   ebx
 80491a5:	83 ec 10             	sub    esp,0x10
 80491a8:	e8 8f 00 00 00       	call   804923c <__x86.get_pc_thunk.ax>
 80491ad:	05 47 2e 00 00       	add    eax,0x2e47
 80491b2:	8b 45 08             	mov    eax,DWORD PTR [ebp+0x8]
 80491b5:	8b 4d 0c             	mov    ecx,DWORD PTR [ebp+0xc]
 80491b8:	8b 55 10             	mov    edx,DWORD PTR [ebp+0x10]
 80491bb:	89 c3                	mov    ebx,eax
 80491bd:	b8 03 00 00 00       	mov    eax,0x3
 80491c2:	cd 80                	int    0x80
 80491c4:	89 45 f8             	mov    DWORD PTR [ebp-0x8],eax
 80491c7:	8b 45 f8             	mov    eax,DWORD PTR [ebp-0x8]
 80491ca:	8b 5d fc             	mov    ebx,DWORD PTR [ebp-0x4]
 80491cd:	c9                   	leave
 80491ce:	c3                   	ret

080491cf <main>:
 80491cf:	8d 4c 24 04          	lea    ecx,[esp+0x4]
 80491d3:	83 e4 f0             	and    esp,0xfffffff0
 80491d6:	ff 71 fc             	push   DWORD PTR [ecx-0x4]
 80491d9:	55                   	push   ebp
 80491da:	89 e5                	mov    ebp,esp
 80491dc:	53                   	push   ebx
 80491dd:	51                   	push   ecx
 80491de:	83 ec 50             	sub    esp,0x50
 80491e1:	e8 ca fe ff ff       	call   80490b0 <__x86.get_pc_thunk.bx>
 80491e6:	81 c3 0e 2e 00 00    	add    ebx,0x2e0e
 80491ec:	c7 45 f4 00 00 00 00 	mov    DWORD PTR [ebp-0xc],0x0
 80491f3:	68 00 01 00 00       	push   0x100
 80491f8:	8d 45 aa             	lea    eax,[ebp-0x56]
 80491fb:	50                   	push   eax
 80491fc:	6a 00                	push   0x0
 80491fe:	e8 9e ff ff ff       	call   80491a1 <sys_read>
 8049203:	83 c4 0c             	add    esp,0xc
 8049206:	8b 45 f4             	mov    eax,DWORD PTR [ebp-0xc]
 8049209:	3d 43 43 43 43       	cmp    eax,0x43434343
 804920e:	75 07                	jne    8049217 <main+0x48>
 8049210:	e8 61 ff ff ff       	call   8049176 <win>
 8049215:	eb 16                	jmp    804922d <main+0x5e>
 8049217:	8b 45 f4             	mov    eax,DWORD PTR [ebp-0xc]
 804921a:	83 ec 08             	sub    esp,0x8
 804921d:	50                   	push   eax
 804921e:	8d 83 4b e0 ff ff    	lea    eax,[ebx-0x1fb5]
 8049224:	50                   	push   eax
 8049225:	e8 16 fe ff ff       	call   8049040 <printf@plt>
 804922a:	83 c4 10             	add    esp,0x10
 804922d:	b8 00 00 00 00       	mov    eax,0x0
 8049232:	8d 65 f8             	lea    esp,[ebp-0x8]
 8049235:	59                   	pop    ecx
 8049236:	5b                   	pop    ebx
 8049237:	5d                   	pop    ebp
 8049238:	8d 61 fc             	lea    esp,[ecx-0x4]
 804923b:	c3                   	ret

0804923c <__x86.get_pc_thunk.ax>:
 804923c:	8b 04 24             	mov    eax,DWORD PTR [esp]
 804923f:	c3                   	ret

Disassembly of section .fini:

08049240 <_fini>:
 8049240:	53                   	push   ebx
 8049241:	83 ec 08             	sub    esp,0x8
 8049244:	e8 67 fe ff ff       	call   80490b0 <__x86.get_pc_thunk.bx>
 8049249:	81 c3 ab 2d 00 00    	add    ebx,0x2dab
 804924f:	83 c4 08             	add    esp,0x8
 8049252:	5b                   	pop    ebx
 8049253:	c3                   	ret
