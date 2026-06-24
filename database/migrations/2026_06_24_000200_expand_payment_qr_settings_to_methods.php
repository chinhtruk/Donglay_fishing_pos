<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_qr_settings', function (Blueprint $table) {
            $table->string('code', 20)->nullable()->after('id');
            $table->string('name', 120)->nullable()->after('code');
            $table->string('type', 20)->default('qr')->after('name');
            $table->unsignedInteger('sort_order')->default(10)->after('type');
        });

        DB::table('payment_qr_settings')
            ->whereNull('type')
            ->orWhere('type', '')
            ->update(['type' => 'qr']);

        $qrRow = DB::table('payment_qr_settings')->where('type', 'qr')->orderBy('id')->first();
        if ($qrRow) {
            DB::table('payment_qr_settings')
                ->where('id', $qrRow->id)
                ->update([
                    'code' => $qrRow->code ?: 'qr',
                    'name' => $qrRow->name ?: 'QR chuyển khoản',
                    'type' => 'qr',
                    'sort_order' => 10,
                ]);
        } else {
            DB::table('payment_qr_settings')->insert([
                'code' => 'qr',
                'name' => 'QR chuyển khoản',
                'type' => 'qr',
                'sort_order' => 10,
                'is_enabled' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! DB::table('payment_qr_settings')->where('code', 'cash')->exists()) {
            DB::table('payment_qr_settings')->insert([
                'code' => 'cash',
                'name' => 'Tiền mặt',
                'type' => 'cash',
                'sort_order' => 0,
                'is_enabled' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('payment_qr_settings', function (Blueprint $table) {
            $table->dropColumn(['code', 'name', 'type', 'sort_order']);
        });
    }
};
