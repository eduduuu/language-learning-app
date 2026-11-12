import os
import zipfile

def create_epub(output_path: str, title: str, author: str, chapters: list[dict]):
    """
    Creates a valid EPUB file with standard container, OPF package, NCX, and XHTML chapters.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with zipfile.ZipFile(output_path, "w") as zf:
        # 1. mimetype (must be first, uncompressed)
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        
        # 2. META-INF/container.xml
        container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>"""
        zf.writestr("META-INF/container.xml", container_xml, compress_type=zipfile.ZIP_DEFLATED)
        
        # 3. Chapter XHTML files
        manifest_items = []
        spine_items = []
        nav_points = []
        
        for idx, ch in enumerate(chapters, start=1):
            ch_filename = f"chapter_{idx}.xhtml"
            ch_id = f"chapter_{idx}"
            
            paragraphs_html = "\n".join(f"    <p>{p}</p>" for p in ch["paragraphs"])
            
            xhtml_content = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
<head>
    <meta charset="utf-8"/>
    <title>{ch['title']}</title>
</head>
<body>
    <h2>{ch['title']}</h2>
{paragraphs_html}
</body>
</html>"""
            zf.writestr(f"OEBPS/{ch_filename}", xhtml_content, compress_type=zipfile.ZIP_DEFLATED)
            manifest_items.append(f'<item id="{ch_id}" href="{ch_filename}" media-type="application/xhtml+xml"/>')
            spine_items.append(f'<itemref idref="{ch_id}"/>')
            nav_points.append(f"""    <navPoint id="navPoint-{idx}" playOrder="{idx}">
        <navLabel><text>{ch['title']}</text></navLabel>
        <content src="{ch_filename}"/>
    </navPoint>""")

        # 4. TOC NCX
        ncx_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:{title}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle><text>{title}</text></docTitle>
    <docAuthor><text>{author}</text></docAuthor>
    <navMap>
{chr(10).join(nav_points)}
    </navMap>
</ncx>"""
        zf.writestr("OEBPS/toc.ncx", ncx_content, compress_type=zipfile.ZIP_DEFLATED)
        manifest_items.append('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>')

        # 5. OEBPS/content.opf
        opf_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>{title}</dc:title>
        <dc:creator opf:role="aut">{author}</dc:creator>
        <dc:language>ja</dc:language>
        <dc:identifier id="BookID" opf:scheme="UUID">urn:uuid:{title}</dc:identifier>
    </metadata>
    <manifest>
        {chr(10).join(manifest_items)}
    </manifest>
    <spine toc="ncx">
        {chr(10).join(spine_items)}
    </spine>
</package>"""
        zf.writestr("OEBPS/content.opf", opf_content, compress_type=zipfile.ZIP_DEFLATED)
    
    print(f"Created: {output_path}")


# 1. 走れメロス (太宰治)
meros_chapters = [
    {
        "title": "一、激怒と決意",
        "paragraphs": [
            "メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。メロスには政治がわからぬ。メロスは、村の牧人である。笛を吹き、羊と遊んで暮して来た。けれども、邪悪に対しては、人一倍に敏感であった。",
            "きょう未明メロスは村を出発し、野を越え山越え、十里はなれた此のシラクスの市にやって来た。メロスには父も、母も無い。女房も無い。十六の、内気な妹と二人暮しだ。この妹は、村の或る律気な一牧人を、近々、花婿として迎える事になっていた。結婚式も間近かなのである。",
            "メロスは、それゆえ、花嫁の衣裳やら祝宴の御馳走やらを買いに、はるばる市にやって来たのだ。品々を買いまわり、日が没して、市中を歩いていると、何やら様子が変であった。静まり返っている。人影もまばらである。メロスは不審に思った。",
        ]
    },
    {
        "title": "二、親友セリヌンティウス",
        "paragraphs": [
            "路で逢った老爺を捕えて、何事があるのかと尋ねた。老爺は顔色を変えて言った。「王様が人を殺します。」「なぜ殺すのだ。」「悪心を抱いている、というのでございます。」「王は乱心か。」「いいえ、人を信ずる事が出来ぬのでございます。疑わしい者は、片っ端から処刑されます。」",
            "メロスは憤激した。「生かしてはおけぬ。」メロスは単純な男であった。買い物を背負ったままで、のそのそ王城にはいって行った。たちまち捕えられ、短剣を懐中から発見され、王の前に引き出された。",
            "暴君ディオニスは静かに笑い、「お前は何を企てていたのだ」と問うた。「市を暴君の手から救うのだ」とメロスは悪びれずに答えた。王は言った。「磔の刑に処す。」",
            "メロスは言った。「死を恐れて命乞いなどせぬ。だが、私の命を奪う前に、三日間の猶予を与えてくれ。たった一人の妹に、結婚式を挙げさせてやりたいのだ。」王は嘲笑った。「嘘を言うな。逃げるに決まっている。」",
            "「逃げはせぬ。私には友がある。シラクスの石工セリヌンティウスだ。彼を人質としてここに置いていく。もし私が三日目の日没までに帰って来なかったら、彼を処刑してくれ。」王はその申し出を受け入れた。",
        ]
    },
    {
        "title": "三、約束と疾走",
        "paragraphs": [
            "セリヌンティウスは何も言わず、ただ頷いてメロスと抱き合い、牢に入った。メロスはすぐに出発した。豪雨をつき、山を越え、村へ戻り、妹の結婚式を無事に執り行わせた。",
            "そして三日目の早朝、メロスは走り出した。「待っていろ、セリヌンティウス！ 私は必ず帰る！」しかし運命は過酷であった。昨夜の豪雨で川は氾濫し橋は落ち、山賊が道を塞ぎ、夏の太陽が照りつけて体力を奪った。",
            "メロスは倒れた。「もう駄目だ。身体が動かぬ。」だがふと耳を澄ますと、岩の裂け目から清水が湧き出ていた。メロスは水を飲み、蘇った。「私は信頼に報いねばならぬ！ 走れ、メロス！」",
            "日没間近、磔台に引き出されたセリヌンティウスのもとへ、血まみれのメロスが飛び込んだ。「待て！ 殺してはならぬ！ メロスが帰って来た！」群衆はどよめき、暴君ディオニスは二人の友情に打たれ、遂に処刑を取りやめ自らの過ちを認めたのであった。",
        ]
    }
]

# 2. 注文の多い料理店 (宮沢賢治)
ryoriten_chapters = [
    {
        "title": "一、山奥の二人の紳士",
        "paragraphs": [
            "二人の若い紳士が、すっかりイギリスの兵隊のかたちをして、ぴかぴかする鉄砲をかついで、白熊のような犬を二疋つれて、だいぶ山奥の、この葉のかさかさしたとこを、こんなことを言ひながら、あるいてをりました。",
            "「ぜんたい、ここらの山は怪しからんね。鳥も獣も一疋も居やがらん。なんでも構はないから、早くタンタタタンタンと、やってみたいもんだな。」",
            "「鹿の黄いろな横っ腹なんぞに、二三発お見舞まうしたら、痛快だらうね。くるくるまはって、それからどたんと倒れるだらうね。」",
            "それはだいぶの山奥でした。案内してきた猟師も、途中で迷ってどこかへ行ってしまいました。犬も二疋とも、急にめまいを起こして死んでしまいました。",
            "「山が青黒くて、風がどうどう吹いて、寒いね。腹がへったし、帰ろうじゃないか。」二人は相談しました。「戻るにしても道がわからん。困ったな。」その時、ふと後ろを見ますと、立派な洋館がありました。",
        ]
    },
    {
        "title": "二、山猫軒の扉",
        "paragraphs": [
            "玄関にはガラス戸があり、金色でこう書いてありました。『西洋料理店 山猫軒』「おや、こんな山奥に西洋料理店があるぞ。ちょうどいい、入ろう。」",
            "扉を開けると、青い文字でこうありました。『当軒は注文の多い料理店ですからどうかそこはご承知ください』「なるほど、流行っている店なんだな。繁盛している証拠だ。」",
            "次の扉にはこうありました。『鉄砲と弾丸をここへ置いてください』二人は鉄砲を外して棚に置きました。次の扉には、『帽子と外套と靴をお脱ぎください』とありました。二人は言われた通りに脱ぎました。",
            "さらに次の扉には、『ネクタイピン、カフスボタン、眼鏡、財布、その他金属性のものをすべてここへ置いてください』とありました。「電気でも使う治療的な料理なのかな。」二人は貴重品も全部置いて進みました。",
        ]
    },
    {
        "title": "三、壺のクリーム",
        "paragraphs": [
            "次の扉の前に、ガラスの壺が置いてあり、こう書いてありました。『壺の中のクリームを顔や手足にすっかり塗ってください』",
            "二人は顔を見合わせました。「クリームを塗る？ なぜだ？」「外が寒くて肌が荒れるのを防ぐ親切じゃないか。」二人はクリームを顔や手足に丹念に塗りたくりました。",
            "そして最後の扉の前に来ました。そこには恐ろしい文字が書いてありました。『いろいろ注文が多くてうるさかったでしょう。お気の毒でした。もうこれでおしまいです。どうか体中に塩をよく揉み込んで、中へお入りください。』",
            "「……！！」「料理を注文する店じゃない……客を料理して食べる店なんだ！！」二人の顔は紙のように青ざめ、ガタガタと震え出しました。鍵穴の向こうから青い二つの大きな目玉がこちらを覗いていました。",
            "その時、風がどうと吹き込み、草むらから死んだはずの犬たちが飛び込んできて扉を破り、妖怪を追い払いました。二人は無事に助かりましたが、恐怖で青ざめた顔は、東京へ帰っても二度と元には戻りませんでした。",
        ]
    }
]

# 3. 坊っちゃん (夏目漱石)
bocchan_chapters = [
    {
        "title": "一、親譲りの無鉄砲",
        "paragraphs": [
            "親譲りの無鉄砲で小供の時から損ばかりしている。小学校に居る時分学校の二階から飛び降りて一週間ほど腰を抜かした事がある。なぜそんな無闇をしたと聞く人があるかも知れぬ。別段深い理由でもない。新築の二階から首を出していたら、同級生の一人が冗談に、いくら威張っても、そこから飛び降りる事は出来まい。弱虫やーい。と囃したからである。",
            "小使に負ぶさって帰って来た時、おやじが大きな眼をして二階ぐらいから飛び降りて腰を抜かす奴があるかと云ったから、この次は抜かさずに飛んで見せますと答えた。",
            "親類のものから西洋製のナイフを貰って、奇麗な刃を日に翳して、友達に見せていたら、一人が光る事は光るが切れそうもないと云った。切れぬ事があるか、何でも切ってみせると受け合った。そんなら君の指を切ってみろと注文した。何を、指位この通りだと右の手の親指の甲を斜めに切り込んだ。幸いナイフが小さく、骨が堅かったから親指の骨は折れなかったが、傷跡は死ぬまで消えない。",
        ]
    },
    {
        "title": "二、清の真心",
        "paragraphs": [
            "母が死んでから、家にはおやじと兄貴と、清という下女の三人暮しになった。おやじも兄貴も俺の事を乱暴者だと嫌っていたが、清だけはなぜか俺を可愛がってくれた。",
            "清はいつでも俺に、「坊っちゃんは気立てが正直で、将来きっとご立派になられますよ」と褒めてくれた。俺が学校で喧嘩をして帰っても、清だけは味方になって菓子や小遣いをくれた。",
            "「清、お前はなぜそんなに俺を贔屓にするんだ。」と聞くと、「坊っちゃんのお母様が亡くなる時、坊っちゃんの事を頼みますとおっしゃいましたからね」と笑っていた。清の温かい心だけが、俺の荒んだ少年時代の救いであった。",
        ]
    },
    {
        "title": "三、四国への旅立ち",
        "paragraphs": [
            "物理学校を卒業した時、校長から「四国の中学校で数学の教師が一人足りない。行ってみないか」と話があった。月給は四十円だという。",
            "俺は「行きましょう」と即座に返事をした。東京を離れるのは清と別れるのが名残惜しかったが、男が一匹独り立ちする潮時だと思った。",
            "旅立つ前の晩、清の家へ挨拶に行った。清は目に涙を浮かべて、「坊っちゃん、どうかお体を大切にしてください。立派な先生になってください」と見送ってくれた。俺は汽車の窓から手を振り、未知の四国・松山へと向かったのである。",
        ]
    }
]

if __name__ == "__main__":
    out_dir = "frontend/public/samples"
    create_epub(f"{out_dir}/hashire_merosu.epub", "走れメロス", "太宰治", meros_chapters)
    create_epub(f"{out_dir}/chumon_no_ryoriten.epub", "注文の多い料理店", "宮沢賢治", ryoriten_chapters)
    create_epub(f"{out_dir}/bocchan.epub", "坊っちゃん", "夏目漱石", bocchan_chapters)
    print("All sample EPUBs generated successfully!")
