import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            StudyTogether
          </div>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>注册</Button>
            </Link>
          </div>
        </nav>

        <div className="text-center max-w-4xl mx-auto" data-testid="home-content">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            找到你的学习伙伴
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            实时查看全球正在学习的伙伴，发现附近的学习者，让学习不再孤单
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-semibold mb-2">全球学习地图</h3>
              <p className="text-gray-600 dark:text-gray-400">
                实时查看全球正在学习的伙伴，感受全球学习氛围
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-2">附近匹配</h3>
              <p className="text-gray-600 dark:text-gray-400">
                发现附近正在学习相同科目的伙伴，一起进步
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold mb-2">隐私保护</h3>
              <p className="text-gray-600 dark:text-gray-400">
                模糊位置显示，完全掌控你的隐私设置
              </p>
            </div>
          </div>

          <div className="space-x-4">
            <Link href="/register">
              <Button size="lg" data-testid="home-register-btn" className="text-lg px-8 py-6">
                开始学习之旅
              </Button>
            </Link>
            <Link href="/map">
              <Button size="lg" data-testid="home-map-btn" variant="outline" className="text-lg px-8 py-6">
                查看学习地图
              </Button>
            </Link>
          </div>

          <div className="mt-16 text-gray-600 dark:text-gray-400">
            <p>已有数千名学习者正在使用 StudyTogether</p>
          </div>
        </div>
      </div>
    </div>
  );
}
