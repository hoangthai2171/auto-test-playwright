const readline = require("node:readline/promises");
const fs = require("node:fs");
const {stdin: input, stdout: output} = require("node:process");
const {spawn} = require("node:child_process");

const defaults = {
    APP_URL: "https://html5stage.mytv.vn/",
    USERNAME: "ts1",
    PASSWORD: "111222",
    CHANNEL_NAME: "VTV1 HD",
};

const playbackModes = {
    channel: {
        label: "Kênh",
        specs: ["tests/login-mytv.spec.js", "tests/play-channel-mytv.spec.js"],
    },
    movie: {
        label: "Phim truyện",
        specs: ["tests/login-mytv.spec.js", "tests/play-movie-mytv.spec.js"],
    },
    search: {
        label: "Tìm kiếm nội dung",
        specs: ["tests/login-mytv.spec.js", "tests/search-content-mytv.spec.js"],
    },
};

const playbackModeQuestion = [
    "Bạn muốn chạy test nào?",
    "1. Kênh",
    "2. Phim truyện",
    "3. Tìm kiếm nội dung",
    "Lựa chọn [1]: ",
].join("\n");

const channelPlayModeQuestion = [
    "Bạn muốn play kênh nào?",
    "1. Tự nhập tên kênh",
    "2. Play theo cate",
    "Lựa chọn [1]: ",
].join("\n");

const moviePlayModeQuestion = [
    "Bạn muốn play phim nào?",
    "1. Phim đầu tiên",
    "2. Tự nhập tên phim",
    "3. Play theo cate",
    "Lựa chọn [1]: ",
].join("\n");

async function main() {
    const values = input.isTTY ? await promptTtyValues() : promptPipedValues();
    const code = await runPlaywright(values);
    process.exit(code);
}

async function promptTtyValues() {
    const rl = readline.createInterface({input, output});

    try {
        const values = {};

        for (const [key, defaultValue] of Object.entries(baseDefaults())) {
            const answer = await rl.question(`${key} [${defaultValue}]: `);
            values[key] = answer.trim() || defaultValue;
        }

        values.PLAYBACK_MODE = await promptPlaybackMode(rl);

        if (values.PLAYBACK_MODE === "channel") {
            values.CHANNEL_PLAY_MODE = await promptChannelPlayMode(rl);

            if (values.CHANNEL_PLAY_MODE === "by_name") {
                const answer = await rl.question(`CHANNEL_NAME [${defaults.CHANNEL_NAME}]: `);
                values.CHANNEL_NAME = answer.trim() || defaults.CHANNEL_NAME;
            }

            if (values.CHANNEL_PLAY_MODE === "by_cate") {
                values.CHANNEL_CATE_NAME = await promptChannelCateName(rl);
                values.CHANNEL_CATE_LIMIT = await promptChannelCateLimit(rl);
            }
        }

        if (values.PLAYBACK_MODE === "movie") {
            values.MOVIE_PLAY_MODE = await promptMoviePlayMode(rl);

            if (values.MOVIE_PLAY_MODE === "by_name") {
                values.MOVIE_NAME = await promptMovieName(rl);
            }

            if (values.MOVIE_PLAY_MODE === "by_cate") {
                values.MOVIE_CATE_NAME = await promptMovieCateName(rl);
                values.MOVIE_CATE_LIMIT = await promptMovieCateLimit(rl);
            }
        }

        if (values.PLAYBACK_MODE === "search") {
            values.SEARCH_KEYWORD = await promptSearchKeyword(rl);
        }

        return values;
    } finally {
        rl.close();
    }
}

function promptPipedValues() {
    const lines = fs.readFileSync(0, "utf8").split(/\r?\n/);
    const values = {};
    let lineIndex = 0;

    for (const [key, defaultValue] of Object.entries(baseDefaults())) {
        output.write(`${key} [${defaultValue}]: `);
        values[key] = (lines[lineIndex] || "").trim() || defaultValue;
        lineIndex++;
    }

    output.write(playbackModeQuestion);
    values.PLAYBACK_MODE = parsePlaybackMode(lines[lineIndex] || "") || "channel";
    lineIndex++;

    if (values.PLAYBACK_MODE === "channel") {
        output.write(channelPlayModeQuestion);
        values.CHANNEL_PLAY_MODE = parseChannelPlayMode(lines[lineIndex] || "") || "by_name";
        lineIndex++;

        if (values.CHANNEL_PLAY_MODE === "by_name") {
            output.write(`CHANNEL_NAME [${defaults.CHANNEL_NAME}]: `);
            values.CHANNEL_NAME = (lines[lineIndex] || "").trim() || defaults.CHANNEL_NAME;
            lineIndex++;
        }

        if (values.CHANNEL_PLAY_MODE === "by_cate") {
            output.write("CHANNEL_CATE_NAME: ");
            values.CHANNEL_CATE_NAME = (lines[lineIndex] || "").trim();
            lineIndex++;

            output.write("CHANNEL_CATE_LIMIT [0]: ");
            values.CHANNEL_CATE_LIMIT = (lines[lineIndex] || "").trim() || "0";
            lineIndex++;
        }
    }

    if (values.PLAYBACK_MODE === "movie") {
        output.write(moviePlayModeQuestion);
        values.MOVIE_PLAY_MODE = parseMoviePlayMode(lines[lineIndex] || "") || "first";
        lineIndex++;

        if (values.MOVIE_PLAY_MODE === "by_name") {
            output.write("MOVIE_NAME: ");
            values.MOVIE_NAME = (lines[lineIndex] || "").trim();
            lineIndex++;
        }

        if (values.MOVIE_PLAY_MODE === "by_cate") {
            output.write("MOVIE_CATE_NAME: ");
            values.MOVIE_CATE_NAME = (lines[lineIndex] || "").trim();
            lineIndex++;

            output.write("MOVIE_CATE_LIMIT [0]: ");
            values.MOVIE_CATE_LIMIT = (lines[lineIndex] || "").trim() || "0";
            lineIndex++;
        }
    }

    if (values.PLAYBACK_MODE === "search") {
        output.write("SEARCH_KEYWORD: ");
        values.SEARCH_KEYWORD = (lines[lineIndex] || "").trim();
    }

    output.write("\n");
    return values;
}

function baseDefaults() {
    return {
        APP_URL: defaults.APP_URL,
        USERNAME: defaults.USERNAME,
        PASSWORD: defaults.PASSWORD,
    };
}

async function promptPlaybackMode(rl) {
    for (;;) {
        const answer = await rl.question(playbackModeQuestion);
        const mode = parsePlaybackMode(answer);

        if (mode) return mode;
        output.write("Vui lòng nhập 1 cho Kênh hoặc 2 cho Phim truyện.\n");
    }
}

async function promptMoviePlayMode(rl) {
    for (;;) {
        const answer = await rl.question(moviePlayModeQuestion);
        const mode = parseMoviePlayMode(answer);

        if (mode) return mode;
        output.write("Vui lòng nhập 1 cho Phim đầu tiên, 2 để tự nhập tên phim hoặc 3 để play theo cate.\n");
    }
}

async function promptChannelPlayMode(rl) {
    for (;;) {
        const answer = await rl.question(channelPlayModeQuestion);
        const mode = parseChannelPlayMode(answer);

        if (mode) return mode;
        output.write("Vui lòng nhập 1 để tự nhập tên kênh hoặc 2 để play theo cate.\n");
    }
}

async function promptChannelCateName(rl) {
    for (;;) {
        const answer = await rl.question("CHANNEL_CATE_NAME: ");
        const cateName = answer.trim();

        if (cateName) return cateName;
        output.write("Vui lòng nhập tên cate kênh cần play.\n");
    }
}

async function promptChannelCateLimit(rl) {
    for (;;) {
        const answer = await rl.question("CHANNEL_CATE_LIMIT [0] - Nhập 0 để play toàn bộ kênh: ");
        const limit = answer.trim() || "0";

        if (/^\d+$/.test(limit)) return limit;
        output.write("Vui lòng nhập số lượng kênh là số nguyên từ 0 trở lên.\n");
    }
}

async function promptMovieName(rl) {
    for (;;) {
        const answer = await rl.question("MOVIE_NAME: ");
        const movieName = answer.trim();

        if (movieName) return movieName;
        output.write("Vui lòng nhập tên phim cần tìm.\n");
    }
}

async function promptMovieCateName(rl) {
    for (;;) {
        const answer = await rl.question("MOVIE_CATE_NAME: ");
        const cateName = answer.trim();

        if (cateName) return cateName;
        output.write("Vui lòng nhập tên cate cần play.\n");
    }
}

async function promptMovieCateLimit(rl) {
    for (;;) {
        const answer = await rl.question("MOVIE_CATE_LIMIT [0] - Nhập 0 để play toàn bộ phim: ");
        const limit = answer.trim() || "0";

        if (/^\d+$/.test(limit)) return limit;
        output.write("Vui lòng nhập số lượng phim là số nguyên từ 0 trở lên.\n");
    }
}

async function promptSearchKeyword(rl) {
    for (;;) {
        const answer = await rl.question("SEARCH_KEYWORD: ");
        const keyword = answer.trim();

        if (keyword) return keyword;
        output.write("Vui lòng nhập từ khoá tìm kiếm.\n");
    }
}

function parsePlaybackMode(value) {
    const answer = value.trim().toLowerCase();
    if (!answer || answer === "1" || answer === "kenh" || answer === "kênh" || answer === "channel") {
        return "channel";
    }

    if (answer === "2" || answer === "phim" || answer === "phim truyen" || answer === "phim truyện" || answer === "movie") {
        return "movie";
    }

    if (answer === "3" || answer === "search" || answer === "tim kiem" || answer === "tìm kiếm") {
        return "search";
    }

    return "";
}

function parseMoviePlayMode(value) {
    const answer = value.trim().toLowerCase();
    if (!answer || answer === "1" || answer === "first" || answer === "phim đầu tiên" || answer === "phim dau tien") {
        return "first";
    }

    if (answer === "2" || answer === "name" || answer === "by_name" || answer === "ten" || answer === "tên") {
        return "by_name";
    }

    if (answer === "3" || answer === "cate" || answer === "category" || answer === "by_cate" || answer === "play theo cate") {
        return "by_cate";
    }

    return "";
}

function parseChannelPlayMode(value) {
    const answer = value.trim().toLowerCase();
    if (!answer || answer === "1" || answer === "name" || answer === "by_name" || answer === "ten" || answer === "tên") {
        return "by_name";
    }

    if (answer === "2" || answer === "cate" || answer === "category" || answer === "by_cate" || answer === "play theo cate") {
        return "by_cate";
    }

    return "";
}

function runPlaywright(values) {
    const {PLAYBACK_MODE, ...envValues} = values;
    const mode = playbackModes[PLAYBACK_MODE] || playbackModes.channel;

    return new Promise((resolve, reject) => {
        const child = spawn("npx", ["playwright", "test", "--headed", ...mode.specs, ...process.argv.slice(2)], {
            stdio: "inherit",
            env: {
                ...process.env,
                ...envValues,
            },
        });

        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (signal) {
                process.kill(process.pid, signal);
                return;
            }

            resolve(code ?? 1);
        });
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
