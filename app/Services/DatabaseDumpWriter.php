<?php

namespace App\Services;

use RuntimeException;

class DatabaseDumpWriter
{
    public function createSqlDump(): string
    {
        $connection = config('database.default');
        $database = config("database.connections.{$connection}");
        if (! in_array($database['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Chức năng sao lưu hiện chỉ hỗ trợ MySQL/MariaDB.');
        }

        $binary = $this->resolveMysqldumpBinary();

        $basePath = tempnam(sys_get_temp_dir(), 'donglay-db-');
        if ($basePath === false) {
            throw new RuntimeException('Không thể tạo file sao lưu tạm thời.');
        }

        $sqlPath = $basePath.'.sql';
        @unlink($basePath);

        try {
            $this->dumpMysql($database, $sqlPath, $binary);

            return $sqlPath;
        } catch (\Throwable $error) {
            @unlink($sqlPath);

            throw $error;
        }
    }

    private function resolveMysqldumpBinary(): string
    {
        $binary = (string) config('data-management.mysqldump_binary', 'mysqldump');
        // Chỉ cho phép tên file hoặc đường dẫn tuyệt đối, chặn injection
        if (str_contains($binary, ';') || str_contains($binary, '&') || str_contains($binary, '|')) {
            throw new RuntimeException('Đường dẫn mysqldump không hợp lệ.');
        }
        // Nếu là đường dẫn tuyệt đối thì kiểm tra file tồn tại và executable
        if (str_starts_with($binary, '/')) {
            if (! is_file($binary) || ! is_executable($binary)) {
                throw new RuntimeException('Không tìm thấy binary mysqldump tại đường dẫn đã cấu hình.');
            }
        }

        return $binary;
    }

    private function dumpMysql(array $database, string $sqlPath, string $binary): void
    {
        $command = [
            $binary,
            '--single-transaction',
            '--quick',
            '--routines',
            '--triggers',
            '--events',
            '--no-tablespaces',
            '--default-character-set='.($database['charset'] ?? 'utf8mb4'),
            '--host='.($database['host'] ?? '127.0.0.1'),
            '--port='.($database['port'] ?? 3306),
            '--user='.($database['username'] ?? ''),
            '--result-file='.$sqlPath,
            (string) ($database['database'] ?? ''),
        ];
        $pipes = [];
        $environment = array_merge(getenv() ?: [], [
            'MYSQL_PWD' => (string) ($database['password'] ?? ''),
        ]);
        $process = proc_open($command, [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ], $pipes, base_path(), $environment);

        if (! is_resource($process)) {
            throw new RuntimeException('Không thể khởi động mysqldump.');
        }

        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $errorOutput = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        if ($exitCode !== 0 || ! is_file($sqlPath) || filesize($sqlPath) === 0) {
            $details = trim($errorOutput ?: $output ?: 'mysqldump không tạo được dữ liệu.');
            throw new RuntimeException('Không thể tạo bản sao lưu database: '.$details);
        }
    }

}
