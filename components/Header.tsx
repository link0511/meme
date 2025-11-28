import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="py-8 text-center space-y-4">
      <div className="inline-flex items-center justify-center p-2 bg-slate-800 rounded-full mb-4 ring-1 ring-slate-700">
        <span className="text-xs font-semibold px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full">
          Powered by 甜菜
        </span>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500">
        毛毛狐表情包助手
      </h1>
      <p className="text-slate-400 max-w-lg mx-auto text-lg">
        上传照片，AI 自动为您生成 LINE 风格的手写中文 Q 版表情包。
      </p>
    </header>
  );
};