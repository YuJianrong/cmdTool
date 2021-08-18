import axios from 'axios';
import fs from 'fs';
import cheerio from 'cheerio';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import { writeToString } from '@fast-csv/format';

axiosCookieJarSupport(axios);

const userInfo = fs
  .readFileSync('./userInfo.txt', 'utf-8')
  .split('\n')
  .map((str) => str.trim())
  .map((str) => str.split(/\s+/))
  .filter((arr) => arr.length >= 2);

const baseURL = process.env.baseURL || 'https://www.bookwalker.com.tw';

let accounts: { email: string; point: number; coupon: number }[] = [];
async function testInfo() {
  for (const [email, passwd] of userInfo) {
    console.log(`process ${email}`);
    try {
      const cookieJar = new tough.CookieJar();
      const ax = axios.create({
        baseURL,
        jar: cookieJar,
        withCredentials: true,
      });

      const loginPage = await ax.get('/user/login');
      if (loginPage.status !== 200) {
        throw new Error(`Error access /user/login: [${loginPage.status}]: [${loginPage.data}]`);
      }
      const $loginPage = cheerio.load(loginPage.data);

      const body = {
        _token: $loginPage('#login_from input[name="_token"]').attr('value'),
        email,
        passwd,
        recaptcha_pass: '1',
        jp_member: '',
      };
      const loginInfo = await ax.post('/user/login', body);
      if (loginInfo.status !== 200) {
        throw new Error(`Error login on /user/login: [${loginInfo.status}]: [${loginInfo.data}]`);
      }

      const $loginInfo = cheerio.load(loginInfo.data);
      if ($loginInfo('#error_msg').length > 0) {
        throw new Error(
          `Error login on /user/login: ${$loginInfo('#error_msg').text().replace(/\s*/g, '')}`,
        );
      }

      const member = await ax.get('/member');
      if (member.status !== 200) {
        throw new Error(`Error access /member: [${member.status}]: [${member.data}]`);
      }
      const $member = cheerio.load(member.data);
      const [point, coupon] = $member('.user_point .point_detail .point')
        .toArray()
        .map((elm) => $member(elm).text())
        .map((text) => parseInt(text, 10));
      console.log(`Points: ${point} , Coupons: ${coupon}`);
      accounts.push({ email, point, coupon });
    } catch (error) {
      console.error(error.message || error);
    }
  }
  accounts = accounts.sort(
    ({ point: a1, coupon: a2 }, { point: b1, coupon: b2 }) => b1 * 10 ** 5 + b2 - a1 * 10 ** 5 - a2,
  );
  const str = await writeToString(
    accounts.map(({ email, point, coupon }) => [email, point, coupon]),
  );
  console.log(str);
  fs.writeFileSync('./result.csv', str);
}

testInfo();
