"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Mail,
  Calendar,
  TrendingUp,
  Star,
  Shield,
  Bell,
  Settings,
  CreditCard
} from "lucide-react";

interface UserStats {
  totalWatchlistItems: number;
  totalIntelligenceFeeds: number;
  avgTrapProbability: number;
  successfulSignals: number;
}

export function UserDashboard() {
  const { user, isLoaded } = useUser();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user stats
  const fetchUserStats = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate some data
      setTimeout(() => {
        setUserStats({
          totalWatchlistItems: 8,
          totalIntelligenceFeeds: 24,
          avgTrapProbability: 65,
          successfulSignals: 12,
        });
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserStats();
    }
  }, [isLoaded, user]);

  if (!isLoaded || !user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>用户资料</CardTitle>
              <CardDescription>
                您的个人信息和账户设置
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              编辑资料
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {user.firstName?.charAt(0) || user.username?.charAt(0) || "U"}
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username || "交易员"
                  }
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Shield className="h-3 w-3 mr-1" />
                    专业版
                  </Badge>
                  <Badge variant="outline">
                    量化交易员
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 mr-2" />
                  邮箱
                </div>
                <div className="font-medium">
                  {user.primaryEmailAddress?.emailAddress || "未设置"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  注册时间
                </div>
                <div className="font-medium">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "未知"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Bell className="h-4 w-4 mr-2" />
                  通知设置
                </div>
                <div className="font-medium">
                  已开启
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Stats */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{userStats.totalWatchlistItems}</div>
                  <div className="text-sm text-muted-foreground">自选股票</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Star className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <Progress value={Math.min(userStats.totalWatchlistItems * 10, 100)} className="mt-4" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{userStats.totalIntelligenceFeeds}</div>
                  <div className="text-sm text-muted-foreground">情报分析</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <Progress value={Math.min(userStats.totalIntelligenceFeeds * 2, 100)} className="mt-4" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{userStats.avgTrapProbability}%</div>
                  <div className="text-sm text-muted-foreground">平均陷阱概率</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
              </div>
              <Progress value={userStats.avgTrapProbability} className="mt-4" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{userStats.successfulSignals}</div>
                  <div className="text-sm text-muted-foreground">成功信号</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <Progress value={Math.min(userStats.successfulSignals * 8, 100)} className="mt-4" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            常用功能和设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center">
              <Star className="h-6 w-6 mb-2" />
              <span>管理自选股</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center">
              <Bell className="h-6 w-6 mb-2" />
              <span>通知设置</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center">
              <Settings className="h-6 w-6 mb-2" />
              <span>偏好设置</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center">
              <CreditCard className="h-6 w-6 mb-2" />
              <span>订阅管理</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>
            您最近的操作记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: "添加了贵州茅台到自选股", time: "10分钟前", type: "add" },
              { action: "收到宁德时代高风险预警", time: "1小时前", type: "warning" },
              { action: "查看了平安银行分析报告", time: "2小时前", type: "view" },
              { action: "更新了止损价设置", time: "3小时前", type: "update" },
              { action: "收到AI策略推荐", time: "5小时前", type: "recommendation" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    activity.type === "add" ? "bg-green-100 text-green-600" :
                    activity.type === "warning" ? "bg-red-100 text-red-600" :
                    activity.type === "view" ? "bg-blue-100 text-blue-600" :
                    "bg-purple-100 text-purple-600"
                  }`}>
                    {activity.type === "add" && <Star className="h-4 w-4" />}
                    {activity.type === "warning" && <Shield className="h-4 w-4" />}
                    {activity.type === "view" && <TrendingUp className="h-4 w-4" />}
                    {activity.type === "update" && <Settings className="h-4 w-4" />}
                    {activity.type === "recommendation" && <CreditCard className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium">{activity.action}</div>
                    <div className="text-sm text-muted-foreground">{activity.time}</div>
                  </div>
                </div>
                <Badge variant="outline">
                  {activity.type === "add" && "添加"}
                  {activity.type === "warning" && "预警"}
                  {activity.type === "view" && "查看"}
                  {activity.type === "update" && "更新"}
                  {activity.type === "recommendation" && "推荐"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}