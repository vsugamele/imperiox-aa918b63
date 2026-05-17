// Listas PT→EN para o Hyper Prompt Generator
// Cada campo tem opções e o valor "__free__" abre input livre

export type Opt = { label: string; value: string };
export const FREE: Opt = { label: "✎ LIVRE — escrever...", value: "__free__" };

export const genero: Opt[] = [
  { label: "Feminino (woman)", value: "woman" },
  { label: "Masculino (man)", value: "man" },
  FREE,
];

export const tipoPersonagem: Opt[] = [
  { label: "Cartomante / Fortune teller", value: "fortune teller" },
  { label: "Fotógrafo", value: "photographer" },
  { label: "Barista", value: "barista" },
  { label: "Chef", value: "chef" },
  { label: "Artista", value: "artist" },
  { label: "Músico(a)", value: "musician" },
  { label: "Viajante", value: "traveler" },
  { label: "Modelo", value: "fashion model" },
  { label: "Empresário(a)", value: "entrepreneur" },
  { label: "Estudante", value: "student" },
  { label: "Escritor(a)", value: "writer" },
  { label: "Dançarino(a)", value: "dancer" },
  FREE,
];

export const fenotipo: Opt[] = [
  { label: "— sem especificar —", value: "" },
  { label: "Caucasiano", value: "caucasian" },
  { label: "Latino(a)", value: "latina" },
  { label: "Afrodescendente", value: "afrodescendant" },
  { label: "Asiático(a)", value: "asian" },
  { label: "Mediterrâneo", value: "mediterranean" },
  { label: "Nórdico", value: "nordic" },
  { label: "Indígena", value: "indigenous" },
  { label: "Mestiço", value: "mixed-race" },
  { label: "Médio-oriental", value: "middle-eastern" },
  FREE,
];

export const tomPele: Opt[] = [
  { label: "Porcelana", value: "porcelain" },
  { label: "Pálida", value: "pale" },
  { label: "Clara", value: "fair" },
  { label: "Oliva", value: "olive" },
  { label: "Caramelo", value: "caramel" },
  { label: "Bronzeada", value: "bronzed" },
  { label: "Sun-kissed", value: "sun-kissed" },
  { label: "Dourada bronzeada", value: "golden tanned" },
  { label: "Marrom escura", value: "deep brown" },
  { label: "Ébano", value: "ebony" },
  FREE,
];

export const expressao: Opt[] = [
  { label: "Olhar calmo e sábio", value: "calm knowing gaze" },
  { label: "Sorriso sedutor", value: "seductive confident smile" },
  { label: "Olhar introspectivo", value: "introspective contemplative look" },
  { label: "Sorriso provocante", value: "playful smirk" },
  { label: "Olhar intenso direto", value: "intense direct stare" },
  { label: "Sorriso acolhedor", value: "warm welcoming smile" },
  { label: "Meio-sorriso misterioso", value: "mysterious half-smile" },
  { label: "Expressão séria focada", value: "serious focused expression" },
  { label: "Sorriso suave de paz", value: "peaceful soft smile" },
  FREE,
];

export const cabeloEstilo: Opt[] = [
  { label: "Longo liso", value: "long straight" },
  { label: "Longo ondulado", value: "long wavy" },
  { label: "Longo cacheado", value: "long curly" },
  { label: "Médio liso", value: "medium straight" },
  { label: "Médio ondulado", value: "medium wavy" },
  { label: "Médio cacheado", value: "medium curly" },
  { label: "Bob curto", value: "short bob" },
  { label: "Buzz cut", value: "buzz cut" },
  { label: "Pompadour", value: "pompadour" },
  { label: "Coque baixo", value: "low bun" },
  { label: "Coque alto", value: "high bun" },
  { label: "Coque bagunçado", value: "messy bun" },
  { label: "Rabo de cavalo", value: "ponytail" },
  { label: "Trançado", value: "braided hair" },
  { label: "Dreadlocks", value: "dreadlocks" },
  { label: "Man-bun", value: "man bun" },
  { label: "Slicked-back", value: "slicked-back hair" },
  { label: "Undercut", value: "undercut" },
  { label: "Black power / afro", value: "natural afro" },
  { label: "Tousled bagunçado", value: "tousled bedhead" },
  { label: "Careca / bald", value: "shaved head" },
  FREE,
];

export const cabeloCor: Opt[] = [
  { label: "Preto azeviche", value: "jet-black" },
  { label: "Castanho escuro", value: "dark brown" },
  { label: "Castanho médio", value: "medium brown" },
  { label: "Castanho claro", value: "light brown" },
  { label: "Caramelo", value: "caramel" },
  { label: "Loiro mel", value: "honey blonde" },
  { label: "Loiro platinado", value: "platinum blonde" },
  { label: "Loiro avermelhado", value: "strawberry blonde" },
  { label: "Ruivo cobre", value: "copper red" },
  { label: "Acaju", value: "mahogany" },
  { label: "Grisalho salt-and-pepper", value: "salt-and-pepper" },
  { label: "Prateado", value: "silver" },
  { label: "Branco", value: "white" },
  { label: "Tingido rosa", value: "dyed pastel pink" },
  { label: "Tingido azul", value: "dyed electric blue" },
  { label: "Tingido roxo", value: "dyed deep purple" },
  FREE,
];

export const roupa: Opt[] = [
  { label: "Camisa de linho creme oversized", value: "oversized cream linen shirt with rolled-up sleeves" },
  { label: "Corset de seda preta com decote V", value: "deep V-cut black silk corset top with delicate lace trim" },
  { label: "Vestido fluido de linho branco bordado", value: "flowing white linen dress with crocheted details" },
  { label: "Camiseta band vintage com jeans", value: "vintage band t-shirt knotted at the waist over high-waisted jeans" },
  { label: "Conjunto lingerie de seda champagne", value: "champagne silk-and-lace lingerie set" },
  { label: "Camisa bordada bordô aberta", value: "deep burgundy embroidered open-collar shirt" },
  { label: "Jaqueta de couro com tank top", value: "black leather motorcycle jacket over a white tank top" },
  { label: "Cardigan vintage sobre polo", value: "oversized vintage knit cardigan over a beige polo shirt" },
  { label: "Avental floral sobre blusa simples", value: "floral apron over a worn long-sleeved blouse" },
  { label: "Xale de veludo preto bordado", value: "heavy black velvet shawl with intricate gold embroidery" },
  { label: "Slip dress moderno verde-esmeralda", value: "emerald green satin slip dress with thin straps" },
  FREE,
];

export const acessorios: Opt[] = [
  { label: "Brincos dourados + anel discreto", value: "delicate gold hoop earrings, a thin silver pinky ring" },
  { label: "Anéis antigos + pingente obsidiana", value: "multiple antique signet rings and a heavy obsidian pendant" },
  { label: "Anéis prata + argolas grandes", value: "chunky silver rings on most fingers and oversized brass hoop earrings" },
  { label: "Pérolas longas + brincos diamante", value: "long strand of pearls and art deco diamond earrings" },
  { label: "Colares de miçangas com cristais", value: "stacked beaded necklaces with small crystal pendants" },
  { label: "Gargantilha + brincos cristal", value: "wide silver chain choker and dangling crystal earrings" },
  { label: "Corrente de relógio + óculos", value: "pocket watch chain and vintage round-frame glasses" },
  { label: "Body chains dourados + argolas", value: "layered golden body chains and oversized hoop earrings" },
  { label: "Sem joias, só uma pulseira simples", value: "no jewelry except a single thin leather bracelet" },
  { label: "Cinto de couro + pulseiras", value: "wide leather belt and stacked cord bracelets" },
  FREE,
];

export const pose: Opt[] = [
  { label: "Sentado(a) à mesa segurando objeto", value: "sitting at a small wooden table holding a single object close to her chest" },
  { label: "Inclinado(a) sobre mesa com itens", value: "leaning forward over a low table with cards spread around" },
  { label: "Reclinado(a) numa chaise longue", value: "reclining elegantly on a chaise longue" },
  { label: "Sentado(a) de pernas cruzadas no tapete", value: "seated cross-legged on a rug looking up at the camera" },
  { label: "Em pé junto à janela", value: "standing by a window with soft natural light wrapping the silhouette" },
  { label: "Ajoelhado(a) sobre manta", value: "kneeling on a blanket leaning over a low tray" },
  { label: "Caminhando em movimento", value: "walking mid-stride captured in natural motion" },
  { label: "Em banqueta com queixo na mão", value: "seated on a stool with elbow resting on knee, chin in hand" },
  { label: "Deitado(a) em tapete persa", value: "lying on a patterned rug propped up on one elbow" },
  FREE,
];

export const prop: Opt[] = [
  { label: "Carta de tarô erguida", value: "a tarot card lifted near her face" },
  { label: "Xícara de café fumegante", value: "a steaming porcelain cup of coffee" },
  { label: "Taça de vinho tinto", value: "a crystal coupe of dark red wine" },
  { label: "Livro de couro antigo", value: "a vintage leather-bound book" },
  { label: "Vela acesa", value: "a flickering pillar candle" },
  { label: "Tigela com frutas frescas", value: "a small bowl of fresh fruit" },
  { label: "Esfera de cristal polida", value: "a polished crystal sphere" },
  { label: "Diário aberto com anotações", value: "an open journal with handwritten notes" },
  { label: "Câmera analógica nas mãos", value: "a film camera held loosely in both hands" },
  FREE,
];

export const cenario: Opt[] = [
  { label: "Cozinha vintage do interior", value: "modest 1980s countryside kitchen with blue-tiled walls and lace curtains" },
  { label: "Apartamento moderno minimalista", value: "contemporary Pinterest-style apartment with off-white plaster walls" },
  { label: "Loft industrial urbano", value: "lived-in industrial loft with exposed red brick and tall steel-frame windows" },
  { label: "Sala íntima de boudoir", value: "intimate boudoir-style reading parlor with deep crimson velvet drapes" },
  { label: "Boudoir parisiense ensolarado", value: "sunlit Parisian-style boudoir with sheer linen curtains" },
  { label: "Feira de rua animada", value: "bustling open-air street market with hanging tapestries" },
  { label: "Câmara ritual escura", value: "dimly lit ritual chamber with dark stone walls and candlelight" },
  { label: "Sala anos 70 classe média", value: "warm 1970s middle-class living room with wood-paneled walls" },
  { label: "Jardim caseiro com plantas", value: "lush overgrown home garden with ceramic pots and climbing vines" },
  { label: "Quarto íntimo cama desfeita", value: "intimate bedroom scene with rumpled white linen sheets" },
  { label: "Tenda boêmia ensolarada", value: "bohemian sun-drenched tent with layered kilim rugs" },
  { label: "Praia tropical no pôr do sol", value: "golden-hour tropical beach with soft wet sand" },
  { label: "Banheiro vintage italiano", value: "vintage Italian bathroom with hand-painted ceramic tiles" },
  { label: "Penthouse noturno com vista", value: "sleek nighttime penthouse with floor-to-ceiling city windows" },
  { label: "Diner americano anos 50", value: "classic American diner with neon signs and vinyl booths" },
  { label: "Palco de cabaret", value: "intimate cabaret stage with velvet curtains and spotlights" },
  { label: "Festival no deserto", value: "sun-scorched desert music festival with dusty haze" },
  { label: "Loft escuro luxuoso", value: "dark luxurious loft with velvet furniture and moody low light" },
  FREE,
];

export const horario: Opt[] = [
  { label: "Manhã dourada na janela", value: "warm golden morning light streaming through a window" },
  { label: "Meio-dia com luz filtrada", value: "bright midday sun filtered through sheer curtains" },
  { label: "Golden hour lateral", value: "warm late-afternoon golden hour sunlight pouring sideways" },
  { label: "Pôr do sol rosado", value: "soft pink-orange sunset light bleeding through the frame" },
  { label: "Blue hour pós-pôr do sol", value: "moody blue hour just after sunset" },
  { label: "Luz de vela dramática", value: "dramatic low-key candlelight with deep amber tones" },
  { label: "Luz de abajur tungstênio", value: "warm tungsten lamp light with low-key shadows" },
  { label: "Noite urbana com neon", value: "urban night with neon signs casting colored reflections" },
  { label: "Dia nublado difuso", value: "overcast diffused daylight with no hard shadows" },
  { label: "Tarde chuvosa com reflexos", value: "rainy afternoon with reflections on wet surfaces" },
  { label: "Madrugada com névoa", value: "pre-dawn bluish mist with quiet atmospheric haze" },
  FREE,
];

export const luzDirecao: Opt[] = [
  { label: "Difusa suave envolvendo o rosto", value: "soft diffused natural light wrapping the face evenly" },
  { label: "Lateral dura com sombras profundas", value: "hard sculpted sidelight creating sharp highlights and deep shadows" },
  { label: "Rim light quente no contorno", value: "warm rim light along the silhouette and hair" },
  { label: "Luz pontilhada filtrada", value: "dappled light filtering through leaves or fabric" },
  { label: "Chiaroscuro dramático", value: "dramatic chiaroscuro with profound velvet-black shadows" },
  { label: "Pin spot único de teto", value: "single overhead pin spot creating sharp highlights" },
  { label: "Mista natural + tungstênio", value: "mixed natural and warm tungsten sources creating contrast" },
  { label: "Bounce light de paredes claras", value: "soft bounce light from light-colored walls" },
  { label: "Atmosfera enevoada halation", value: "hazy atmospheric light with lens halation and bloom" },
  FREE,
];

export const colorGrade: Opt[] = [
  { label: "Tons mel quentes", value: "warm honey tones with lifted milky shadows" },
  { label: "Editorial limpo frio", value: "clean editorial cool whites with low contrast" },
  { label: "Burgundy + âmbar cinematográfico", value: "rich burgundy and amber palette with deep teal shadows" },
  { label: "Tons terrosos vibrantes", value: "vibrant warm earth tones with cyan-shifted shadows" },
  { label: "Indie desaturado", value: "muted desaturated indie palette with lifted blacks" },
  { label: "Nostálgico magenta nas sombras", value: "nostalgic warm tones with slight magenta cast in shadows" },
  { label: "Gótico oxblood-obsidiana", value: "dark gothic palette dominated by oxblood and obsidian" },
  { label: "Sun-baked dourado-vermelho", value: "sun-baked golden-red palette with warm crushed blacks" },
  { label: "Teal-and-orange Hollywood", value: "Hollywood teal-and-orange complementary grade" },
  { label: "Pastel suave pêssego", value: "soft pastel tones with peach highlights and creamy whites" },
  FREE,
];

const camerasList = [
  "Sony A7R V","Sony A1","Sony A7 IV","Sony A7S III","Canon EOS R5","Canon EOS R6 II",
  "Nikon Z9","Nikon Z8","Fujifilm X-T5","Fujifilm GFX 100S","Fujifilm GFX 50R",
  "Hasselblad X2D 100C","Hasselblad X1D II 50C","Hasselblad H6D-100c","Leica Q2","Leica M11",
  "Leica SL2-S","Pentax 67 II","Panasonic S1H","Phase One IQ4",
];
export const camera: Opt[] = [...camerasList.map(c => ({ label: c, value: c })), FREE];

export const lente: Opt[] = [
  { label: "24mm f/1.4 — grande-angular", value: "24mm f/1.4" },
  { label: "28mm f/1.7 — grande-angular", value: "28mm f/1.7" },
  { label: "35mm f/1.4 — clássica", value: "35mm f/1.4" },
  { label: "50mm f/1.2 — normal rápida", value: "50mm f/1.2" },
  { label: "50mm f/1.4 — normal", value: "50mm f/1.4" },
  { label: "85mm f/1.2 — retrato premium", value: "85mm f/1.2" },
  { label: "85mm f/1.4 — retrato clássica", value: "85mm f/1.4" },
  { label: "90mm f/2 — retrato médio", value: "90mm f/2" },
  { label: "105mm f/2.4 — médio formato", value: "105mm f/2.4" },
  { label: "110mm f/2 — médio formato", value: "110mm f/2" },
  { label: "135mm f/1.8 — tele curto", value: "135mm f/1.8" },
  FREE,
];

export const abertura: Opt[] = [
  { label: "f/1.2 — bokeh extremo", value: "1.2" },
  { label: "f/1.4 — muito raso", value: "1.4" },
  { label: "f/1.8 — raso", value: "1.8" },
  { label: "f/2 — raso clássico", value: "2" },
  { label: "f/2.8 — médio", value: "2.8" },
  { label: "f/4 — médio", value: "4" },
  { label: "f/5.6 — geral", value: "5.6" },
  { label: "f/8 — paisagem", value: "8" },
  FREE,
];

export const iso: Opt[] = [
  { label: "ISO 100 — limpo", value: "100" },
  { label: "ISO 200", value: "200" },
  { label: "ISO 400 — clássico", value: "400" },
  { label: "ISO 800", value: "800" },
  { label: "ISO 1600 — pouca luz", value: "1600" },
  { label: "ISO 3200 — noturno", value: "3200" },
  FREE,
];

export const shutter: Opt[] = [
  { label: "1/60s", value: "60" },
  { label: "1/100s", value: "100" },
  { label: "1/125s", value: "125" },
  { label: "1/200s", value: "200" },
  { label: "1/250s", value: "250" },
  { label: "1/500s", value: "500" },
  { label: "1/1000s", value: "1000" },
  FREE,
];

const filmesList = [
  "Kodak Portra 160","Kodak Portra 400","Kodak Portra 800","Kodak Gold 200","Kodak Ektar 100",
  "Kodak Vision3 250D","Kodak Vision3 500T","Kodak Aerocolor IV 250","Kodak Ultramax 400",
  "Kodak Vision3 200T","Kodak 2393 print","Cinestill 50D","Cinestill 800T","CineStill 400D",
  "Fujifilm Pro 400H","Fujifilm Provia 100F","Fujifilm Velvia 50","Fujifilm Astia 100F",
  "Fujifilm Pro 800Z","Fujifilm Eterna 250D","Lomochrome Metropolis",
];
export const filme: Opt[] = [...filmesList.map(f => ({ label: f, value: f })), FREE];

export const estiloFinal: Opt[] = [
  { label: "Documentário candid / UGC", value: "candid documentary, UGC style" },
  { label: "Editorial moderno / revista", value: "modern editorial, magazine quality" },
  { label: "Street / National Geographic", value: "street documentary, National Geographic quality" },
  { label: "Cinematográfico escuro / fine-art", value: "dark cinematic, fine-art photography quality" },
  { label: "Álbum de família nostálgico", value: "nostalgic family album, archival film quality" },
  { label: "Lifestyle bohemian dreamy", value: "lifestyle bohemian, dreamy editorial quality" },
  { label: "Cinema íntimo A24", value: "intimate cinematic portrait, A24-style aesthetic" },
  { label: "Indie cinematográfico urbano", value: "indie cinematic, urban editorial quality" },
  { label: "Sensual editorial / Vogue", value: "sensual editorial, high-fashion Vogue quality" },
  { label: "Glamour vintage pin-up", value: "glamour vintage pin-up photography quality" },
  { label: "Gótico dark fantasy art-house", value: "gothic dark fantasy, art-house quality" },
  { label: "High-fashion editorial Vogue", value: "high-fashion editorial, Vogue magazine quality" },
  { label: "Travel magazine glamour", value: "travel magazine glamour, wanderlust editorial" },
  FREE,
];
