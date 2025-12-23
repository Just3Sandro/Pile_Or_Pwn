
examples/stack3.elf:     file format elf32-i386


Disassembly of section .init:

08049000 <_init>:
 8049000:	53                   	push   ebx
 8049001:	83 ec 08             	sub    esp,0x8
 8049004:	e8 a7 00 00 00       	call   80490b0 <__x86.get_pc_thunk.bx>
 8049009:	81 c3 db 2f 00 00    	add    ebx,0x2fdb
 804900f:	8b 83 18 00 00 00    	mov    eax,DWORD PTR [ebx+0x18]
 8049015:	85 c0                	test   eax,eax
 8049017:	74 02                	je     804901b <_init+0x1b>
 8049019:	ff d0                	call   eax
 804901b:	83 c4 08             	add    esp,0x8
 804901e:	5b                   	pop    ebx
 804901f:	c3                   	ret

Disassembly of section .plt:

08049020 <__libc_start_main@plt-0x10>:
 8049020:	ff 35 e8 bf 04 08    	push   DWORD PTR ds:0x804bfe8
 8049026:	ff 25 ec bf 04 08    	jmp    DWORD PTR ds:0x804bfec
 804902c:	00 00                	add    BYTE PTR [eax],al
	...

08049030 <__libc_start_main@plt>:
 8049030:	ff 25 f0 bf 04 08    	jmp    DWORD PTR ds:0x804bff0
 8049036:	68 00 00 00 00       	push   0x0
 804903b:	e9 e0 ff ff ff       	jmp    8049020 <_init+0x20>

08049040 <printf@plt>:
 8049040:	ff 25 f4 bf 04 08    	jmp    DWORD PTR ds:0x804bff4
 8049046:	68 08 00 00 00       	push   0x8
 804904b:	e9 d0 ff ff ff       	jmp    8049020 <_init+0x20>

08049050 <puts@plt>:
 8049050:	ff 25 f8 bf 04 08    	jmp    DWORD PTR ds:0x804bff8
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
 8049070:	81 c3 74 2f 00 00    	add    ebx,0x2f74
 8049076:	6a 00                	push   0x0
 8049078:	6a 00                	push   0x0
 804907a:	51                   	push   ecx
 804907b:	56                   	push   esi
 804907c:	8d 83 a9 d0 ff ff    	lea    eax,[ebx-0x2f57]
 8049082:	50                   	push   eax
 8049083:	e8 a8 ff ff ff       	call   8049030 <__libc_start_main@plt>
 8049088:	f4                   	hlt
 8049089:	8b 1c 24             	mov    ebx,DWORD PTR [esp]
 804908c:	c3                   	ret
 804908d:	e9 12 01 00 00       	jmp    80491a4 <main>
 8049092:	66 90                	xchg   ax,ax
 8049094:	66 90                	xchg   ax,ax
 8049096:	66 90                	xchg   ax,ax
 8049098:	66 90                	xchg   ax,ax
 804909a:	66 90                	xchg   ax,ax
 804909c:	66 90                	xchg   ax,ax
 804909e:	66 90                	xchg   ax,ax

080490a0 <_dl_relocate_static_pie>:
 80490a0:	c3                   	ret
 80490a1:	66 90                	xchg   ax,ax
 80490a3:	66 90                	xchg   ax,ax
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
 80490c0:	b8 08 c0 04 08       	mov    eax,0x804c008
 80490c5:	3d 08 c0 04 08       	cmp    eax,0x804c008
 80490ca:	74 24                	je     80490f0 <__x86.get_pc_thunk.bx+0x40>
 80490cc:	b8 00 00 00 00       	mov    eax,0x0
 80490d1:	85 c0                	test   eax,eax
 80490d3:	74 1b                	je     80490f0 <__x86.get_pc_thunk.bx+0x40>
 80490d5:	55                   	push   ebp
 80490d6:	89 e5                	mov    ebp,esp
 80490d8:	83 ec 14             	sub    esp,0x14
 80490db:	68 08 c0 04 08       	push   0x804c008
 80490e0:	ff d0                	call   eax
 80490e2:	83 c4 10             	add    esp,0x10
 80490e5:	c9                   	leave
 80490e6:	c3                   	ret
 80490e7:	2e 8d b4 26 00 00 00 	lea    esi,cs:[esi+eiz*1+0x0]
 80490ee:	00 
 80490ef:	90                   	nop
 80490f0:	c3                   	ret
 80490f1:	2e 8d b4 26 00 00 00 	lea    esi,cs:[esi+eiz*1+0x0]
 80490f8:	00 
 80490f9:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049100:	b8 08 c0 04 08       	mov    eax,0x804c008
 8049105:	2d 08 c0 04 08       	sub    eax,0x804c008
 804910a:	89 c2                	mov    edx,eax
 804910c:	c1 e8 1f             	shr    eax,0x1f
 804910f:	c1 fa 02             	sar    edx,0x2
 8049112:	01 d0                	add    eax,edx
 8049114:	d1 f8                	sar    eax,1
 8049116:	74 20                	je     8049138 <__x86.get_pc_thunk.bx+0x88>
 8049118:	ba 00 00 00 00       	mov    edx,0x0
 804911d:	85 d2                	test   edx,edx
 804911f:	74 17                	je     8049138 <__x86.get_pc_thunk.bx+0x88>
 8049121:	55                   	push   ebp
 8049122:	89 e5                	mov    ebp,esp
 8049124:	83 ec 10             	sub    esp,0x10
 8049127:	50                   	push   eax
 8049128:	68 08 c0 04 08       	push   0x804c008
 804912d:	ff d2                	call   edx
 804912f:	83 c4 10             	add    esp,0x10
 8049132:	c9                   	leave
 8049133:	c3                   	ret
 8049134:	8d 74 26 00          	lea    esi,[esi+eiz*1+0x0]
 8049138:	c3                   	ret
 8049139:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049140:	f3 0f 1e fb          	endbr32
 8049144:	80 3d 08 c0 04 08 00 	cmp    BYTE PTR ds:0x804c008,0x0
 804914b:	75 1b                	jne    8049168 <__x86.get_pc_thunk.bx+0xb8>
 804914d:	55                   	push   ebp
 804914e:	89 e5                	mov    ebp,esp
 8049150:	83 ec 08             	sub    esp,0x8
 8049153:	e8 68 ff ff ff       	call   80490c0 <__x86.get_pc_thunk.bx+0x10>
 8049158:	c6 05 08 c0 04 08 01 	mov    BYTE PTR ds:0x804c008,0x1
 804915f:	c9                   	leave
 8049160:	c3                   	ret
 8049161:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049168:	c3                   	ret
 8049169:	8d b4 26 00 00 00 00 	lea    esi,[esi+eiz*1+0x0]
 8049170:	f3 0f 1e fb          	endbr32
 8049174:	eb 8a                	jmp    8049100 <__x86.get_pc_thunk.bx+0x50>

08049176 <sys_read>:
 8049176:	55                   	push   ebp
 8049177:	89 e5                	mov    ebp,esp
 8049179:	53                   	push   ebx
 804917a:	83 ec 10             	sub    esp,0x10
 804917d:	e8 9c 00 00 00       	call   804921e <__x86.get_pc_thunk.ax>
 8049182:	05 62 2e 00 00       	add    eax,0x2e62
 8049187:	8b 45 08             	mov    eax,DWORD PTR [ebp+0x8]
 804918a:	8b 4d 0c             	mov    ecx,DWORD PTR [ebp+0xc]
 804918d:	8b 55 10             	mov    edx,DWORD PTR [ebp+0x10]
 8049190:	89 c3                	mov    ebx,eax
 8049192:	b8 03 00 00 00       	mov    eax,0x3
 8049197:	cd 80                	int    0x80
 8049199:	89 45 f8             	mov    DWORD PTR [ebp-0x8],eax
 804919c:	8b 45 f8             	mov    eax,DWORD PTR [ebp-0x8]
 804919f:	8b 5d fc             	mov    ebx,DWORD PTR [ebp-0x4]
 80491a2:	c9                   	leave
 80491a3:	c3                   	ret

080491a4 <main>:
 80491a4:	8d 4c 24 04          	lea    ecx,[esp+0x4]
 80491a8:	83 e4 f0             	and    esp,0xfffffff0
 80491ab:	ff 71 fc             	push   DWORD PTR [ecx-0x4]
 80491ae:	55                   	push   ebp
 80491af:	89 e5                	mov    ebp,esp
 80491b1:	53                   	push   ebx
 80491b2:	51                   	push   ecx
 80491b3:	83 ec 50             	sub    esp,0x50
 80491b6:	e8 f5 fe ff ff       	call   80490b0 <__x86.get_pc_thunk.bx>
 80491bb:	81 c3 29 2e 00 00    	add    ebx,0x2e29
 80491c1:	c7 45 f4 00 00 00 00 	mov    DWORD PTR [ebp-0xc],0x0
 80491c8:	68 00 01 00 00       	push   0x100
 80491cd:	8d 45 b4             	lea    eax,[ebp-0x4c]
 80491d0:	50                   	push   eax
 80491d1:	6a 00                	push   0x0
 80491d3:	e8 9e ff ff ff       	call   8049176 <sys_read>
 80491d8:	83 c4 0c             	add    esp,0xc
 80491db:	8b 45 f4             	mov    eax,DWORD PTR [ebp-0xc]
 80491de:	3d 64 63 62 61       	cmp    eax,0x61626364
 80491e3:	75 14                	jne    80491f9 <main+0x55>
 80491e5:	83 ec 0c             	sub    esp,0xc
 80491e8:	8d 83 24 e0 ff ff    	lea    eax,[ebx-0x1fdc]
 80491ee:	50                   	push   eax
 80491ef:	e8 5c fe ff ff       	call   8049050 <puts@plt>
 80491f4:	83 c4 10             	add    esp,0x10
 80491f7:	eb 16                	jmp    804920f <main+0x6b>
 80491f9:	8b 45 f4             	mov    eax,DWORD PTR [ebp-0xc]
 80491fc:	83 ec 08             	sub    esp,0x8
 80491ff:	50                   	push   eax
 8049200:	8d 83 5b e0 ff ff    	lea    eax,[ebx-0x1fa5]
 8049206:	50                   	push   eax
 8049207:	e8 34 fe ff ff       	call   8049040 <printf@plt>
 804920c:	83 c4 10             	add    esp,0x10
 804920f:	b8 00 00 00 00       	mov    eax,0x0
 8049214:	8d 65 f8             	lea    esp,[ebp-0x8]
 8049217:	59                   	pop    ecx
 8049218:	5b                   	pop    ebx
 8049219:	5d                   	pop    ebp
 804921a:	8d 61 fc             	lea    esp,[ecx-0x4]
 804921d:	c3                   	ret

0804921e <__x86.get_pc_thunk.ax>:
 804921e:	8b 04 24             	mov    eax,DWORD PTR [esp]
 8049221:	c3                   	ret

Disassembly of section .fini:

08049224 <_fini>:
 8049224:	53                   	push   ebx
 8049225:	83 ec 08             	sub    esp,0x8
 8049228:	e8 83 fe ff ff       	call   80490b0 <__x86.get_pc_thunk.bx>
 804922d:	81 c3 b7 2d 00 00    	add    ebx,0x2db7
 8049233:	83 c4 08             	add    esp,0x8
 8049236:	5b                   	pop    ebx
 8049237:	c3                   	ret
