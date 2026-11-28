// JOMON PIX UI localization. User content and canvas drawings are never translated.
// Existing UI strings remain the source-of-truth for behavior/state; translation only
// changes presentation and must not change saved projects or category identifiers.
export type UiLanguage = 'ja' | 'en';
const KEY = 'jomon-pix-ui-language';
let currentLanguage: UiLanguage = readLanguage();
const EVENT = 'jomon-pix-language-change';

function readLanguage(): UiLanguage {
  try {
    return window.localStorage.getItem(KEY) === 'en' ? 'en' : 'ja';
  } catch {
    return 'ja';
  }
}

export function getUiLanguage(): UiLanguage {
  return currentLanguage;
}

export function setUiLanguage(language: UiLanguage): void {
  if (currentLanguage === language) return;
  currentLanguage = language;
  try { window.localStorage.setItem(KEY, language); } catch { /* private mode */ }
  document.documentElement.lang = language;
  window.dispatchEvent(new Event(EVENT));
  refreshUiTranslation();
}

export function onUiLanguageChange(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

// These translations refer exclusively to app chrome, not captions/artwork.
const messages: Record<string, string> = {
  '作品': 'Project',
  'ファイル保存': 'Save File',
  '顔補正': 'Face',
  'メイク': 'Makeup',
  '体型': 'Body',
  '＋ スタンプを追加': '+ Add Sticker',
  '移動': 'Move',
  '回転': 'Rotation',
  '操作パネルの高さを変更': 'Resize editing panel',
  '加工メニュー': 'Editing tools',
  '画像の表示倍率': 'Image zoom',
  'アイコン設定': 'App icon settings',
  '作品を読み込み中…': 'Loading your project…',
  '文字': 'Text', 'ペン': 'Draw', 'スタンプ': 'Stickers',
  'モザイク': 'Mosaic', 'スマート消去': 'Smart Erase', 'ビューティー': 'Beauty',
  '加工': 'Edit', 'フレーム': 'Frames', 'レイヤー': 'Layers',
  '画像': 'Photo', 'ホーム': 'Home', 'プライバシー': 'Privacy',
  'プライバシーポリシー': 'Privacy Policy',
  '画像保存': 'Save Image', '作成中…': 'Creating…',
  '保存中…': 'Saving…', '✓ 自動保存': '✓ Autosaved',
  '⚠ 保存失敗': '⚠ Save failed', '⚠ 自動保存に失敗しました': '⚠ Autosave failed',
  '戻す': 'Undo', 'やり直す': 'Redo', '閉じる': 'Close',
  'モザイクの粗さ': 'Mosaic Size', 'ブラシの太さ': 'Brush Size',
  'ふちどりの太さ': 'Outline Width', '太さ': 'Width',
  '透明度': 'Opacity', '字間': 'Letter Spacing',
  '左から': 'Face ', '人目': ' from left',
  '作品のバックアップと復元': 'Back up / restore project',
  '作品のバックアップ': 'Project backup',
  '編集できる状態で作品を保存・復元': 'Save or restore an editable project',
  '作品をバックアップ': 'Back up project',
  'バックアップを読み込む': 'Import backup',
  '処理中…': 'Processing…',
  '※復元すると今の作品が置き換わります。バックアップには写真も含まれます。':
    'Restoring replaces the current project. Backups also include the original photos.',
  '作品を自動保存できませんでした。': 'Could not autosave this project.',
  '既存の作品データを保護するため、この画面では自動保存を停止しています。':
    'Autosave has stopped to protect the existing project data.',
  'ブラウザのデータを削除したり、新しい作品を作ったりしないでください。':
    'Do not clear browser data or start a new project.',
  'このまま画面を閉じると、変更内容が失われる可能性があります。':
    'Closing this screen may cause unsaved changes to be lost.',
  '上の「画像保存」からPNG画像を書き出すか、📁から作品をバックアップしてください。':
    'Export a PNG with “Save Image”, or back up the project using the folder button.',
  'PNGは再編集用のバックアップではありません。':
    'A PNG is not an editable project backup.',
  '先に写真を追加してください。': 'Add a photo first.',
  '写真を選択': 'Select photo', '写真を選ぶと使えるよ': 'Select a photo to use this.',
  '＋ 写真を追加': '+ Add Photos', '✨ 新しく作る': '✨ New Project',
  '＋ 文字を入れる': '+ Add Text', '＋ もう1つ文字を入れる': '+ Add Another Text',
  '文字を入力': 'Enter text', 'スタイル': 'Style', 'フォント': 'Font', '文字デザイン': 'Text Design',
  '色': 'Color', 'ふちどり': 'Outline', '光る': 'Glow',
  '形': 'Layout', '横書き': 'Horizontal', '縦書き': 'Vertical',
  '左': 'Left', '中央': 'Center', '右': 'Right',
  '吹き出し': 'Speech Bubbles',
  '丸': 'Round', 'ギザギザ': 'Jagged', 'もくもく': 'Cloud', 'LINE風': 'Chat',
  '＋ 吹き出しを追加': '+ Add Speech Bubble',
  'セリフを入力': 'Enter dialogue',
  '吹き出しの形': 'Bubble Shape',
  '吹き出しの色': 'Bubble Color',
  '枠線の色': 'Outline Color',
  'しっぽの向き': 'Tail Direction',
  '左向き': 'Left', '右向き': 'Right',
  '吹き出しの幅': 'Bubble Width',
  '吹き出しを削除': 'Delete Bubble',
  '🗑 文字を削除': '🗑 Delete Text',
  '吹き出しを選択': 'Select a speech bubble',
  '文字の色': 'Text Color',
  '丸の吹き出し': 'Round Bubble',
  'ギザギザの吹き出し': 'Jagged Bubble',
  'もくもくの吹き出し': 'Cloud Bubble',
  'LINE風の吹き出し': 'Chat Bubble',
  'セリフを編集': 'Edit Dialogue',
  '吹き出しをもう1つ追加': 'Add Another Bubble',
  '吹き出しは写真の上で移動・拡大できます。':
    'Move and resize the bubble directly on the photo.',

  '丸・ギザギザ・もくもく・LINE風の吹き出し': 'Round, jagged, cloud and chat bubbles',
  '準備中だよ': 'Coming soon',
  'ペンを描く写真': 'Photo to draw on', '消しゴム': 'Eraser',
  'まじめ': 'Classic', 'かわいい': 'Cute',
  'なし': 'None', 'ビビッド': 'Vivid', 'ふんわり': 'Soft',
  'クール': 'Cool', 'セピア': 'Sepia', 'モノクロ': 'Monochrome',
  '□ 正方形': '□ Square',
  '顔デコ': 'Face Decor', '髪型': 'Hairstyles', '髪色': 'Hair Color', 'サングラス': 'Sunglasses',
  '髪色（選択中の髪型にも反映）': 'Hair color (updates selected hair too)',
  '髪色を選択': 'Select hair color',
  '実写風の透過ヘア素材です。別の髪型を選ぶと同じ人の髪型だけ差し替えます。':
    'Realistic transparent hair overlays. Choosing a new cut replaces the same person\'s hair.',
  '髪型を変更中…': 'Changing hairstyle…',
  '髪型を変更できません。写真や既存の髪型のロックを解除してください。':
    'Unlock the photo or existing hairstyle before replacing it.',
  '角刈り': 'Flat Top', 'アフロ': 'Afro', 'リーゼント': 'Pompadour',
  '黒髪': 'Black', 'ダークブラウン': 'Dark Brown', 'ブラウン': 'Brown',
  'ブロンド': 'Blonde', 'アッシュ': 'Ash', 'レッド': 'Red',
  'ピンク': 'Pink', 'シルバー': 'Silver',
  'ボブ': 'Bob', 'ストレートロング': 'Long Straight', 'ショート': 'Short',
  'ウェーブ': 'Waves', '前髪ありミディアム': 'Medium with Bangs',
  '指でなぞる': 'Brush', '四角で囲む': 'Rectangle',
  'なぞる': 'Brush', '囲む': 'Rectangle', '選択をクリア': 'Clear Selection',
  'クリア': 'Clear',
  '消去する写真': 'Photo to erase', '不要なものを消す': 'Remove unwanted objects',
  '選択範囲をクリア': 'Clear Selection',
  '消去して補完': 'Erase and Fill', '補完中…': 'Filling…',
  'AI消しゴム': 'AI Eraser', 'AI補完': 'AI Fill', '軽量補完': 'Light Fill',
  'AIで消す': 'Erase with AI', 'この結果を適用': 'Apply Result',
  '選択し直す': 'Reselect', '長押しで元画像を比較': 'Hold to Compare Original',
  'AIを準備中…': 'Preparing AI…', 'AIモデルを読み込み中…': 'Loading AI Model…',
  'AIが背景を生成中…': 'AI Rebuilding Background…',
  '画像を仕上げ中…': 'Finishing Image…',
  '補完が完了しました。比較してから適用できます。':
    'Fill complete. Compare and apply when satisfied.',
  'AIが不要物を消して背景を補完します。無料・端末内処理。適用前に比較できます。':
    'AI reconstructs the background on your device for free. Preview before applying.',
  '端末内AIが選択部分の背景を生成します。初回は約28MBのモデルを読み込みます。写真は送信しません。':
    'On-device AI rebuilds the background. First use loads a 28 MB model. Photos never leave your device.',
  '周囲の画像をコピーする従来方式です。AIが重い場合にも使えます。':
    'Lightweight pixel-copy mode. Use it if AI is too slow.',
  '仕上がりを確認してください。': 'Preview your result.',
  '周囲の画像を使って選択部分を補完します。模様が複雑な場所では不自然になることがあります。':
    'Fills the selected area using surrounding pixels. Complex backgrounds may look unnatural.',
  '無料・端末内処理。元の写真は「戻す」で復元できます。':
    'Free, on-device processing. Use Undo to restore the original.',
  '先に写真を追加し、ロックを解除してください。':
    'Add a photo and unlock it first.',

  '全員': 'Everyone', '加工する顔を選択': 'Select Faces to Edit',
  'サングラス装備': 'Sunglasses', 'サングラスの種類': 'Sunglasses Styles',
  '全員または選んだ顔にサングラスを装着': 'Wear sunglasses on all or selected faces',
  '全員の補正をリセット': 'Reset Everyone',
  'この顔の個別設定を解除': 'Remove Individual Adjustments',
  'サングラスを装着中…': 'Placing sunglasses…',
  'サングラスを外す': 'Remove Sunglasses',
  'サングラスを外しています…': 'Removing sunglasses…',
  'サングラスをつける顔を選ぶ': 'Choose who wears sunglasses',
  '写真が変更されました。もう一度お試しください。': 'The photo has changed. Please try again.',
  'サングラスを装着できませんでした。': 'Could not place sunglasses.',
  '顔認識に失敗しました。': 'Face detection failed.',
  '顔を検出できませんでした。': 'No faces detected.',
  '定番ブラック': 'Classic Black', '極太ブラック': 'Bold Black',
  '丸型ゴールド': 'Round Gold', 'オーバル紫': 'Purple Oval',
  'ティアドロップ金': 'Gold Aviator', 'キャットアイ赤': 'Red Cat-Eye',
  'ハートピンク': 'Pink Hearts', '星型イエロー': 'Yellow Stars',
  'ドット8ビット': '8-bit Pixels', '細長Y2Kホワイト': 'White Y2K',
  '一枚レンズ青': 'Blue Shield', 'スポーツラップ': 'Sport Wrap',
  '六角エメラルド': 'Emerald Hex', '蝶々ローズ': 'Rose Butterfly',
  'ゴーグルオレンジ': 'Orange Goggles', 'リムレス': 'Rimless',
  '三角ネオン紫': 'Neon Triangle', 'ダイヤシルバー': 'Silver Diamond',
  'お花ピンク': 'Pink Flower', '炎レッド': 'Red Flame',
  'シャッターメガネ': 'Shutter Shades', 'レーシング蛍光': 'Neon Racing',
  'しずくブルー': 'Blue Teardrop', '八角クラシック': 'Classic Octagon',
  'スクエア白': 'White Square', 'クラブキラキラ': 'Glitter Club',

  '犬': 'Dogs', '縄文': 'Jomon', '絵文字': 'Emoji',
  'その他': 'Other',
  '一緒に動かす写真を選ぶ': 'Attach to a photo',
  'くっつけない': 'Detach',
  '配置済みスタンプを選択': 'Select an added sticker',
  '選択中のスタンプ': 'Selected sticker', '完了': 'Done',
  '大きさ': 'Size', '− 小さく': '− Smaller',
  '＋ 大きく': '+ Larger', '標準': 'Reset',
  '⧉ 複製': '⧉ Duplicate', '🗑 削除': '🗑 Delete',
  '自動配置': 'Auto Place', '手動配置': 'Manual Place',
  '顔の位置を確認中…': 'Detecting faces…',
  '顔を': 'Detected ', '人認識しました': ' faces',
  '顔を選択': 'Select faces', '顔認識を実行中…': 'Detecting faces…',
  'カメラロール → 背景を自動で消す → 登録':
    'Choose photo → remove background → add sticker',
  '選択した顔にスタンプを配置中…': 'Placing sticker on selected face…',
  '顔を検出できませんでした。手動配置をお試しください。':
    'No faces found. Try manual placement.',
  '顔認識に失敗しました。手動配置をお試しください。':
    'Face detection failed. Try manual placement.',
  '顔を認識できません。手動配置をお試しください。':
    'Face not found. Try manual placement.',
  '写真のロック・非表示を解除してください。':
    'Unlock and show the photo first.',
  '編集するものを選択': 'Select an item to edit',
  '配置': 'Arrange', '切り抜き': 'Cutout',
  'キャンバス': 'Canvas', '背景': 'Background',
  '配信・SNS': 'Streaming / Social', '枠': 'Border',
  '⤒ 最前面': '⤒ Bring to Front', '↑ 1つ前へ': '↑ Move Forward',
  '↓ 1つ後ろへ': '↓ Move Backward', '⤓ 最背面': '⤓ Send to Back',
  '⇋ 左右反転': '⇋ Flip Horizontal', '⇵ 上下反転': '⇵ Flip Vertical',
  '🔓 ロック解除': '🔓 Unlock', '🔒 ロック': '🔒 Lock',
  '✂ 写真をトリミング': '✂ Crop Photo',
  '✂️ 背景を消す': '✂️ Remove Background',
  '背景を消しています…': 'Removing background…',
  'キャンバスのサイズ': 'Canvas Size',
  '✂ キャンバスを切り抜く': '✂ Crop Canvas',
  '背景色': 'Background Color',
  '写真': 'Photo',
  'フレームを外す': 'Remove frame',
  'シンプル': 'Simple', '二重フレーム': 'Double Border',
  'ポラロイド': 'Polaroid', 'フィルム': 'Film',
  '卒アル風': 'Yearbook', 'ネオン': 'Neon',
  '雑誌風': 'Magazine', 'すっきりした縁取り': 'Clean outline',
  '上品な二重線': 'Elegant double line',
  '写真プリント風': 'Instant photo style',
  '35mmフィルム風': '35mm film style',
  '角留めの記念写真風': 'Photo album corners',
  '光るフレーム': 'Glowing frame',
  '表紙風の文字付き': 'Magazine cover style',
  'フレームの色': 'Frame Color',
  '切り抜く写真を選択': 'Select photo to cut out',
  '写真の背景を消す': 'Remove Photo Background',
  '切り抜き中…': 'Removing background…',
  '縦9:16に変更': 'Switch to vertical 9:16',
  '※配信画面風の画像加工です': 'Creates a streaming-style photo',
  'まだ何もないよ': 'Nothing here yet',
  '美肌': 'Smooth Skin', '明るさ': 'Brightness',
  '血色': 'Warmth', '小顔': 'Slim Face',
  'あごシャープ': 'Sharper Chin', '目の大きさ': 'Eye Size',
  'リップ': 'Lip Color', 'チーク': 'Blush',
  '脚を細く': 'Slim Legs', '脚を長く': 'Longer Legs',
  '脚の補正をリセット': 'Reset Leg Adjustments',
  '脚の解析に失敗しました。脚の補正は適用していません。':
    'Leg detection failed. Leg adjustments were not applied.',
  '脚を検出できませんでした。脚の補正は適用していません。':
    'No legs detected. Leg adjustments were not applied.',
  '脚の細さは、両脚を認識できる写真で調整できます。':
    'Leg slimming requires both legs to be visible and detected.',
  '脚長は、全身が写った1人の写真で調整できます。':
    'Leg length requires a single standing person with the full body visible.',
  '顔を解析して加工中…': 'Analyzing and editing faces…',
  '顔を検出できませんでした。加工せず元の写真を表示しています。':
    'No faces detected. Showing the original image.',
  '顔認識を利用できません。加工せず元の写真を表示しています。':
    'Face detection unavailable. Showing the original image.',
  '写真を解析して加工中…': 'Analyzing and editing photo…',
  '加工可能な顔・脚を検出できませんでした。元の写真を表示しています。':
    'No suitable face or legs found. Showing the original photo.',
  '顔の補正を表示中です。脚の解析には失敗しました。':
    'Face edits are shown, but leg detection failed.',
  '脚長の補正には、1人で全身が写った写真が必要です。':
    'Leg length adjustment needs a single full-body portrait.',
  'ビューティーの加工を表示しています。': 'Beauty adjustments are being shown.',
  '人物の解析を利用できません。加工せず元の写真を表示しています。':
    'Could not analyze the person. Showing the original photo.',
  '写真のロックを解除してください。': 'Unlock the photo first.',
  '加工前を表示中': 'Showing original', '長押しで比較': 'Hold to compare',
  '加工をリセット': 'Reset Adjustments',
  '範囲指定': 'Rectangle', 'ブラシ': 'Brush',
  '写真全体': 'Entire Photo', '背景だけ': 'Background Only',
  '標準モザイク': 'Standard', 'モザイクの種類': 'Mosaic Styles',
  'ぼかし': 'Blur', 'ドット': 'Dots', '六角形': 'Hexagon',
  '三角形': 'Triangles', '黒塗り': 'Solid Black', 'ハート': 'Hearts',
  'ブラシ風': 'Brush Strokes', 'ぼかしの強さ': 'Blur Strength',
  '背景だけの仕上がりは適用後に確認できます。':
    'Background-only results can be viewed after applying.',
  'モザイク加工': 'Mosaic Editor', '▦ モザイク加工': '▦ Mosaic Editor',
  'ドラッグで範囲指定': 'Drag to select an area',
  '指で塗る': 'Brush over an area',
  '端末内AIで背景を判定します。': 'Background detection runs on your device.',
  '初回はAIモデルを取得します。※AIの判定には誤差があります。':
    'An AI model is downloaded on first use. Results may be imperfect.',
  'モザイク対象の写真': 'Photo to pixelate',
  '写真を読み込み中…': 'Loading photo…',
  '指定した範囲をクリア': 'Clear Selection',
  'キャンセル': 'Cancel',
  '被写体を判定中…': 'Detecting subject…', '加工中…': 'Applying…',
  '背景だけにモザイク': 'Mosaic Background',
  'モザイクを適用': 'Apply Mosaic',
  '▦ 全体にモザイク': '▦ Mosaic Entire Photo',
  '▦ 背景だけモザイク': '▦ Mosaic Background',
  '▦ 範囲を指定': '▦ Select Area',
  '重なり順': 'Layer Order',
  '重なり順パネルを移動': 'Move layer panel',
  '指でドラッグして移動': 'Drag to move',
  'レイヤー一覧を閉じる': 'Close layer list',
  'レイヤー一覧を開く': 'Open layer list',
  'レイヤー一覧（上ほど手前）': 'Layer list (top is front)',
  '非表示': 'Hidden', '表示中': 'Visible', 'ロック中': 'Locked',
  '手前へ移動': 'Move Forward', '奥へ移動': 'Move Backward',
  '拡大': 'Zoom In', '縮小': 'Zoom Out',
  '全体表示': 'Fit to Screen',
  'できあがり！': 'All Done!',
  '完成画像': 'Finished image',
  'サイズ：': 'Size:', '準備中…': 'Preparing…',
  '📷 写真に保存・共有': '📷 Save or Share',
  '共有画面で「画像を保存」を選択': 'Choose “Save Image” in the share sheet',
  '⬇ ファイルに保存': '⬇ Save to Files',
  'キャンバスをトリミング': 'Crop Canvas',
  'プレビューを作成中…': 'Generating preview…',
  'プレビューを更新': 'Refresh Preview',
  '比率': 'Aspect Ratio', '範囲': 'Area',
  '切り抜き後：': 'After Crop:',
  '切り抜く': 'Crop',
  '写真をトリミング': 'Crop Photo',
  'トリミング対象': 'Photo to Crop',
  '作品全体のプレビュー': 'Project Preview',
  '自由': 'Free', '正方形': 'Square',
  '上': 'Top', '下': 'Bottom',
  '画像の作成に失敗しました': 'Could not create the image.',
  'バックアップを作成できませんでした。': 'Could not create a backup.',
  '作品を復元しました。': 'Project restored.',
  'JOMON PIXの対応する作品ファイルではありません。': 'This is not a supported JOMON PIX project file.',
  '作品データの形式またはサイズが正しくありません。': 'Invalid project file format or size.',
  '作品データに重複した要素IDがあります。': 'The project contains duplicate element IDs.',
  '作品ファイルが大きすぎます（上限100MB）。': 'The project file exceeds the 100 MB limit.',
  '作品を端末に保存できなかったため、読み込みを取り消しました。': 'The imported project could not be saved, so the import was cancelled.',
  '作品を読み込めませんでした。': 'Could not load the project.',
  '共有できませんでした。': 'Could not share the image.',
  'もう一度お試しください。': 'Please try again.',
  '画像を長押しして保存してください。': 'Press and hold the image to save.',
  '写真を追加できませんでした': 'Could not add the photo.',
  '今の作品を消して新しく作る？': 'Discard this project and start a new one?',
  '写真がありません。先に写真を追加してください。': 'No photos yet. Add one first.',
  '写真を読み込み中です': 'The photo is still loading.',
  '加工は反映されましたが、自動保存できません。画像サイズや保存容量を確認してください。':
    'The edit was applied, but autosave failed. Check the image size and storage space.',
  '写真の背景を削除できませんでした。': 'Could not remove the photo background.',
  '背景削除に失敗しました。端末の空きメモリを確認してください。': 'Background removal failed. Check available device memory.',
  '顔デコの自動配置に失敗しました。': 'Could not automatically place the face sticker.',
  '写真が変更されたため配置を取り消しました。もう一度お試しください。': 'The photo changed. Placement was cancelled. Try again.',
  '写真が変更されました。画面を閉じて選び直してください': 'The photo changed. Close this dialog and select it again.',
  '写真を読み込めませんでした': 'Could not load the photo.',
  'トリミングに失敗しました': 'Could not crop the photo.',
  'モザイク加工に失敗しました': 'Could not apply the mosaic.',
  'この端末で画像を加工できません': 'Image editing is not supported on this device.',
  'この写真では、その比率に切り抜けません': 'This aspect ratio cannot be applied to the photo.',
  'キャンバスが見つかりません': 'Canvas not found.',
  'プレビューを作成できませんでした': 'Could not generate a preview.',
  '切り抜き範囲が正しくありません': 'Invalid crop area.',
  'このサイズでは、その比率に切り抜けません': 'This size cannot be cropped to that aspect ratio.',
};

const patterns: Array<[RegExp, (...args: string[]) => string]> = [
  [/^顔の加工を表示しています。（(\d+)人の顔を検出）$/, (_full, n) =>
    'Face adjustments shown (' + n + ' faces detected).'],
  [/^顔を(\d+)人認識しました$/, (_full, n) => 'Detected ' + n + ' faces'],
  [/^(.+)を装着$/, (_full, name) => 'Wear ' + translateLabel(name)],
  [/^吹き出しの幅\s*(\d+)px$/, (_full, n) => 'Bubble Width ' + n + 'px'],
  [/^モザイクの粗さ\s*(\d+)px$/, (_full, n) => 'Mosaic Size ' + n + 'px'],
  [/^ぼかしの強さ\s*(\d+)px$/, (_full, n) => 'Blur Strength ' + n + 'px'],
  [/^ブラシの太さ\s*(\d+)%$/, (_full, n) => 'Brush Size ' + n + '%'],
  [/^ふちどりの太さ\s*(\d+)px$/, (_full, n) => 'Outline Width ' + n + 'px'],
  [/^太さ\s*(\d+)(px|%)?$/, (_full, n, unit) => 'Width ' + n + (unit || '')],
  [/^大きさ\s*(\d+)px$/, (_full, n) => 'Size ' + n + 'px'],
  [/^字間\s*(-?\d+)$/, (_full, n) => 'Letter Spacing ' + n],
  [/^透明度\s*(\d+)%$/, (_full, n) => 'Opacity ' + n + '%'],
  [/^左から(\d+)人目$/, (_full, n) => 'Face ' + n + ' from left'],
  [/^配置済みスタンプ(\d+)を選択$/, (_full, n) => 'Select sticker ' + n],
  [/^(.+)を選択$/, (_full, name) => 'Select ' + translateLabel(name)],
  [/^(.+)を追加$/, (_full, name) => 'Add ' + translateLabel(name)],
  [/^(.+)をサングラス対象にする$/, (_full, name) => 'Use '+translateLabel(name)+' for sunglasses'],
  [/^(.+)を自動配置$/, (_full, name) => 'Auto place ' + translateLabel(name)],
  [/^(.+)を顔デコ対象にする$/, (_full, name) => 'Decorate faces in ' + translateLabel(name)],
  [/^(.+)に紐づける$/, (_full, name) => 'Attach to ' + translateLabel(name)],
  [/^(.+)を描画対象にする$/, (_full, name) => 'Draw on ' + translateLabel(name)],
  [/^フレームの色\s*(.+)$/, (_full, color) => 'Frame color ' + color],
  [/^色\s*(.+)$/, (_full, color) => 'Color ' + color],
  [/^(.+)の仕上がり参考画像$/, (_full, name) => 'Frame preview: ' + translateLabel(name)],
  [/^写真\s*(\d+)$/, (_full, n) => 'Photo ' + n],
];

function translateLabel(text: string): string {
  return messages[text] ?? text;
}

export function translateUiText(value: string): string {
  // Use full-string translations to avoid changing project content or identifiers.
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match) return value;
  const leading = match[1];
  const core = match[2];
  const trailing = match[3];
  let english = messages[core];
  if (!english) {
    for (const [regex, replacement] of patterns) {
      const found = regex.exec(core);
      if (found) { english = replacement(...found); break; }
    }
  }
  return english ? leading + english + trailing : value;
}

export function uiMessage(value: string): string {
  return currentLanguage === 'en' ? translateUiText(value) : value;
}

type Snapshot = { ja: string; en: string };
const textSnapshots = new WeakMap<Text, Snapshot>();
const attributeSnapshots = new WeakMap<Element, Map<string, Snapshot>>();
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];
const EXCLUDED = 'script,style,textarea,input,canvas,svg,pre,code,[contenteditable],.konvajs-content,[data-no-translate]';
let observer: MutationObserver | null = null;

function excluded(el: Element | null): boolean {
  return Boolean(el?.closest(EXCLUDED));
}

function translateTextNode(node: Text): void {
  if (excluded(node.parentElement)) return;
  const text = node.nodeValue ?? '';
  let previous = textSnapshots.get(node);
  if (!previous || (text !== previous.ja && text !== previous.en)) {
    const translated = translateUiText(text);
    if (translated === text) return;
    previous = { ja: text, en: translated };
    textSnapshots.set(node, previous);
  }
  const intended = currentLanguage === 'en' ? previous.en : previous.ja;
  if (text !== intended) node.nodeValue = intended;
}

function translateAttributes(el: Element): void {
  if (excluded(el)) return;
  let saved = attributeSnapshots.get(el);
  if (!saved) {
    saved = new Map();
    attributeSnapshots.set(el, saved);
  }
  for (const name of ATTRIBUTES) {
    const original = el.getAttribute(name);
    if (original === null) continue;
    let previous = saved.get(name);
    if (!previous || (original !== previous.ja && original !== previous.en)) {
      const translated = translateUiText(original);
      if (translated === original) continue;
      previous = { ja: original, en: translated };
      saved.set(name, previous);
    }
    const intended = currentLanguage === 'en' ? previous.en : previous.ja;
    if (original !== intended) el.setAttribute(name, intended);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;
  if (root instanceof Element) {
    if (excluded(root)) return;
    translateAttributes(root);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
    } else {
      translateAttributes(node as Element);
    }
  }
}

function refreshUiTranslation(): void {
  if (typeof document === 'undefined' || !document.body) return;
  walk(document.body);
}

export function mountUiTranslation(): () => void {
  document.documentElement.lang = currentLanguage;
  refreshUiTranslation();
  if (observer) observer.disconnect();
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        walk(record.target);
      } else if (record.type === 'attributes') {
        walk(record.target);
      } else {
        for (const node of Array.from(record.addedNodes)) walk(node);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ATTRIBUTES,
  });
  return () => { observer?.disconnect(); observer = null; };
}
