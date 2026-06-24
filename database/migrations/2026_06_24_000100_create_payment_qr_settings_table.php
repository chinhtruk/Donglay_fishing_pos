<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_qr_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_enabled')->default(false);
            $table->string('bank_name', 120)->nullable();
            $table->string('account_name', 120)->nullable();
            $table->string('account_number', 80)->nullable();
            $table->string('transfer_note', 160)->nullable();
            $table->text('extra_info')->nullable();
            $table->string('qr_image_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_qr_settings');
    }
};
