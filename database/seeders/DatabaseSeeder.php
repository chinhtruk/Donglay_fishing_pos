<?php

namespace Database\Seeders;

use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(['username' => 'admin'], ['name' => 'Quản trị viên', 'email' => 'admin@donglay.local', 'email_verified_at' => now(), 'password' => 'Admin@12345', 'role' => 'admin', 'is_active' => true]);
        User::updateOrCreate(['email' => 'nhanvien@donglay.local'], ['name' => 'Nhân viên mẫu', 'username' => null, 'email_verified_at' => now(), 'password' => null, 'role' => 'employee', 'is_active' => true]);

        foreach (range(1, 20) as $index) {
            $column = ($index - 1) % 5;
            $row = intdiv($index - 1, 5);
            CoffeeTable::updateOrCreate(['id' => $index], ['label' => 'Bàn '.$index, 'position_x' => 10 + $column * 20, 'position_y' => 15 + $row * 23, 'is_enabled' => true]);
            FishingSpot::updateOrCreate(['id' => $index], ['label' => 'Chòi '.$index, 'position_x' => 8 + $column * 21, 'position_y' => 12 + $row * 24, 'is_enabled' => true]);
        }

        $items = [
            ['Cà phê', 'Cà phê đen', 25000], ['Cà phê', 'Cà phê sữa', 30000], ['Cà phê', 'Bạc xỉu', 35000],
            ['Trà', 'Trà đào', 35000], ['Trà', 'Trà tắc', 30000], ['Nước', 'Nước suối', 15000],
            ['Đồ ăn', 'Khoai tây chiên', 45000], ['Đồ ăn', 'Mì xào bò', 65000],
        ];
        foreach ($items as [$category, $name, $price]) {
            $categoryModel = MenuCategory::firstOrCreate(
                ['name' => $category],
                ['sort_order' => MenuCategory::count(), 'is_active' => true],
            );
            MenuItem::updateOrCreate(['name' => $name], ['category_id' => $categoryModel->id, 'category' => $categoryModel->name, 'price' => $price, 'is_available' => true]);
        }
    }
}
