import { Link } from 'react-router-dom'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'

const VALUES = [
  {
    title: '結論を急がない',
    body: '答えが出なくても、話した時間そのものに意味があると考えています。',
  },
  {
    title: '聞くだけでもいい',
    body: '話したくなるまで、聞いているだけで参加できます。',
  },
  {
    title: '肩書きを置いてくる',
    body: '会社や役割から少し離れて、ひとりの人として話します。',
  },
]

// TAIWA について(/about)。サービスのコンセプトを、トップのヒーローと同じ夜の空気感の読みものとして伝える
export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-12">
      <p className="text-sm tracking-[0.25em] text-fg-muted">TAIWA について</p>
      <h1 className="mt-5 font-brand text-3xl font-semibold leading-snug tracking-widest text-fg sm:text-4xl sm:leading-snug">
        答えを出すためではなく、
        <br />
        言葉にするための場所。
      </h1>

      <section aria-labelledby="about-unease" className="mt-14">
        <h2 id="about-unease" className="font-brand text-xl font-semibold tracking-wider text-fg">
          なんとなく、違和感がある
        </h2>
        <p className="mt-4 leading-loose text-fg-secondary">
          仕事も生活も、それなりに回っている。でも、ふとした瞬間に「このままでいいのかな」と引っかかる。
          その違和感は、誰かに話すほどでもない気がして、いつのまにか飲み込んでしまう。
        </p>
      </section>

      <section aria-labelledby="about-what" className="mt-12">
        <h2 id="about-what" className="font-brand text-xl font-semibold tracking-wider text-fg">
          TAIWA は、その違和感を話せる場所です
        </h2>
        <p className="mt-4 leading-loose text-fg-secondary">
          TAIWA は、少人数の対話型ワークショップを探して参加できるサービスです。
          テーマは「働くこと」「幸せとは」「孤独について」など、日常のすぐそばにある問い。
          正解を探すのではなく、同じように立ち止まっている人と、ゆっくり言葉を交わします。
        </p>
      </section>

      <section aria-labelledby="about-values" className="mt-12">
        <h2 id="about-values" className="font-brand text-xl font-semibold tracking-wider text-fg">
          大切にしていること
        </h2>
        <ul className="mt-6 space-y-5">
          {VALUES.map((value) => (
            <li key={value.title} className="border-l border-accent/60 pl-4">
              <p className="font-semibold text-fg">{value.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{value.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-first" className="mt-12">
        <h2 id="about-first" className="font-brand text-xl font-semibold tracking-wider text-fg">
          はじめての方へ
        </h2>
        <p className="mt-4 leading-loose text-fg-secondary">
          気になる場を見つけたら、まずは詳細をのぞいてみてください。
          参加の前に「対話のルール」にも目を通してもらえると、安心して当日を迎えられます。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className={PRIMARY_BUTTON_CLASS}
          >
            場をさがす
          </Link>
          <Link
            to="/rules"
            className={SECONDARY_BUTTON_CLASS}
          >
            対話のルールを読む
          </Link>
        </div>
      </section>
    </div>
  )
}
