import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import { CASH_TYPE } from "../../../common/constant/cash_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 端末精算～店舗精算～手動開局（正常系）
 * @memberof 店舗精算
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.STORE_PAYMENT}
 * {@link TAGS.CHECKING_THE_AMOUNT_OF_MONEY}
 * {@link TAGS.TERMINAL_PAYMENT}
 * {@link TAGS.OPENING}
 * {@link TAGS.AUTOMATIC_PAYMENT}
 * {@link TAGS.PAYMENT_PROCESSING}
 * {@link TAGS.STORE_PAYMENT_WHEN_USING_MULTIPLE_TERMINALS}
 * {@link TAGS.INVENTORY_INVENTORY_CONTROL_YESNO}
 * {@link TAGS.PENDING_TRANSACTION_CHECK}
 * ### テスト観点
 * * 在高点検～手動開局までの正常系の一連の流れを確認する。
 * * ＜前提条件＞
 * * * 端末精算を行う端末以外は全て端末精算が完了していること。
 * * * 店舗精算対象外の端末が設定されていること。
 * * * ・在高点検を実施する。
 * * * ・端末精算を実施する。
 * * * ・店舗精算を実施する。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | 準備ステップ | - |
 * | 0.1 | - | `/hold/getList` |
 * | 0.2 | - | `hold/remove` (cart_noが存在すれば削除) | - |
 * | 1 | - | `/authorization` |
 * | 2 | - | `/signin` |
 * | 3 | 在高点検 | `/cash/inspection` |
 * | 4 | 端末精算 | `/settlement` |
 * | 5 | - | `/authorization` |
 * | 6 | - | `/signin` |
 * | 7 | 在高点検 | `/cash/inspection` |
 * | 8 | 端末精算 | `/settlement` |
 * | 9 | - | `/authorization` |
 * | 10 | - | `/signin` |
 * | 11 | 在高点検 | `/cash/inspection` |
 * | 12 | 端末精算 | `/settlement` |
 * | 13 | 端末を除外する (pos_cd: 04) | `store/settlement/exclude-pos` |
 * | 14 | 店舗精算 | `/store/settlement` |
 * | 15 | 開局 | `/open` |
 * | 16 | 端末精算関連のトランを削除（開発用のAPIを実装する必要がある） | - |
 * 
 * ---
 * ### 前提条件
 * * 1.ms-config.c_config_corporate:
 * * * AutoOpenPermissionFlag: false
 * * 2.各POS端末の現金情報は 30,000 円であり、1,000円札が 30 枚含まれていることを前提とする
 * * 3.保留中の取引がすべて削除されていることを前提とする
 * * 4.store_cd："0080"のPos_cd：01、02、03の端末で精算を実施するが、Pos_cd：04の端末で精算を実施しない。
 * * 5.pos_user_04 を店舗決済計算対象外として、API「store`/settlement/exclude-pos`」を使用して除外する
 * * 6.テスト開始前に全てのトランを削除する（devtran-cleanerコンテナの起動）
 * * * 現状はバックエンドアプリの docker-compose up の時点でdevtran-cleanerが起動されるようになっていますが、テストの連続実行ができない状況
 * 
 * ---
 * ### テストデータ
 * * Requestデータ
 * * 1.cash_info_list:
 * * * \+ total_amount: 30000
 * * * \+ cash_type: 7
 * * * \+ count: 30
 * * 2.storeSettlement
 * * * \+ settlement_datetime: step2でのbusiness_day値
 * * 3.storeSettlementExcludePos: 
 * * * \+ pos_cd: "04"
 * * * \+ settlement_business_day: step2でのbusiness_day値
 * * 4.POS精算情報
 * * * \+ user_cd:  pos_user_01
 * * * \+ user_password: pos_user_01
 * * * \+ user_cd:  pos_user_02
 * * * \+ user_password: pos_user_02
 * * * \+ user_cd:  pos_user_03
 * * * \+ user_password: pos_user_03
 * 
 * ---
 * ### 期待結果
 * * #### 2. `/signin`
 * * \- business_day を取得する
 * * #### 3. 在高点検 `/cash/inspection`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 4. 端末精算 `/settlement`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 7. 在高点検 `/cash/inspection`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 8. 端末精算 `/settlement`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 11. 在高点検 `/cash/inspection`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 12. 端末精算 `/settlement`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 13.端末を除外する store`/settlement/exclude-pos` (pos_cd: 04)
 * * \- POS端末は除外するPOSか確認
 * * * \+ pos_cd: 04
 * * * \+ is_settlement_exclude: true
 * * #### 14. 店舗精算 `/store/settlement`
 * * \- business_day が step 2 で取得した business_day と一致していることを確認する
 * * #### 15. 開局 `/open`
 * * \- business_day が当日日付であることを確認する
 */
export function TC_031821001_ManualOpenNormal() {
  group("TC_031821001 端末精算～店舗精算～手動開局（正常系）", () => {
    const preStep = {
      holdGetList: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST),
      holdRemove: CommonFunction.getFullDesc(ENDPOINT.HOLD_REMOVE),
    };

    const step = {
      authPos01: CommonFunction.getFullDesc(ENDPOINT.AUTHORIZATION, "認証 pos_user_01"),
      signInPos01: CommonFunction.getFullDesc(ENDPOINT.SIGNIN, "サインイン pos_user_01"),
      cashInspectionPos01: CommonFunction.getFullDesc(ENDPOINT.CASH_INSPECTION, "在高点検 pos_user_01"),
      settlementPos01: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT, "端末精算 pos_user_01"),
      authPos02: CommonFunction.getFullDesc(ENDPOINT.AUTHORIZATION, "認証 pos_user_02"),
      signInPos02: CommonFunction.getFullDesc(ENDPOINT.SIGNIN, "サインイン pos_user_02"),
      cashInspectionPos02: CommonFunction.getFullDesc(ENDPOINT.CASH_INSPECTION, "在高点検 pos_user_02"),
      settlementPos02: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT, "端末精算 pos_user_02"),
      authPos03: CommonFunction.getFullDesc(ENDPOINT.AUTHORIZATION, "認証 pos_user_03"),
      signInPos03: CommonFunction.getFullDesc(ENDPOINT.SIGNIN, "サインイン pos_user_03"),
      cashInspectionPos03: CommonFunction.getFullDesc(ENDPOINT.CASH_INSPECTION, "在高点検 pos_user_03"),
      settlementPos03: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT, "端末精算 pos_user_03"),
      storeSettlementExcludePos: CommonFunction.getFullDesc(ENDPOINT.STORE_SETTLEMENT_EXCLUDE_POS),
      storeSettlement: CommonFunction.getFullDesc(ENDPOINT.STORE_SETTLEMENT),
      open: CommonFunction.getFullDesc(ENDPOINT.OPEN),
    };

    const posCd = ENVIRONMENT.POS_CD_04; // Test data. It is not subject to store settlement.
    const currentDate = CommonFunction.getTimeNow();
    const cashInfoList = {
      total_amount: 30000, // Test data. Equals 1000円 * 30
      cash_details: [
        {
          cash_type: CASH_TYPE.BILL1000.TYPE, // Test data 1000円
          count: 30, // Test data
        },
      ],
    };

    const cartHolds = TestHelper.holdGetList(preStep.holdGetList, [
      CHECK.createStatusCodeCheck(),
    ]).result?.hold_list_elements;

    if (cartHolds?.length > 0) {
      cartHolds?.forEach((cartHold, index) => {
        TestHelper.holdRemove(`${preStep.holdRemove} ${index + 1}`, {
          cartNo: cartHold?.holdinfo?.cart_no,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      });
    }

    TestHelper.auth(step.authPos01, {
      clientId: ENVIRONMENT.CLIENT_ID,
      userCd: ENVIRONMENT.USER_CD,
      userPassword: ENVIRONMENT.USER_PASSWORD,
      realm: ENVIRONMENT.REALM,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const signInResponse = TestHelper.signin(step.signInPos01, ENVIRONMENT.EMPLOYEE_BARCODE, [
      CHECK.createStatusCodeCheck(),
    ]).result;

    const businessDay = signInResponse?.business_day;

    TestHelper.cashInspection(step.cashInspectionPos01, {
      cashInfoList,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.executePosSettlement(step.settlementPos01, {}, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.auth(step.authPos02, {
      clientId: ENVIRONMENT.CLIENT_ID,
      userCd: ENVIRONMENT.USER_CD_02,
      userPassword: ENVIRONMENT.USER_PASSWORD_02,
      realm: ENVIRONMENT.REALM,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    TestHelper.signin(step.signInPos02, ENVIRONMENT.EMPLOYEE_BARCODE, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.cashInspection(step.cashInspectionPos02, {
      cashInfoList,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.executePosSettlement(step.settlementPos02, {}, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => res.result?.business_day,
      }),
    ]);

    TestHelper.auth(step.authPos03, {
      clientId: ENVIRONMENT.CLIENT_ID,
      userCd: ENVIRONMENT.USER_CD_03,
      userPassword: ENVIRONMENT.USER_PASSWORD_03,
      realm: ENVIRONMENT.REALM,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    TestHelper.signin(step.signInPos03, ENVIRONMENT.EMPLOYEE_BARCODE, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.cashInspection(step.cashInspectionPos03, {
      cashInfoList,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.executePosSettlement(step.settlementPos03, {}, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.storeSettlementExcludePos(step.storeSettlementExcludePos, {
      posCd,
      settlementBusinessDay: businessDay,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the pos has been added to the excluded pos",
        expected: {
          posCd,
          isSettlementExclude: true,
        },
        actual: (res) => {
          const posStatusInfo = res.result?.pos_status_info;
          return {
            posCd: posStatusInfo?.pos_cd,
            isSettlementExclude: posStatusInfo?.is_settlement_exclude,
          };
        },
      }),
    ]);

    TestHelper.storeSettlement(step.storeSettlement, {
      settlementDatetime: businessDay,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is business day in step sign in",
        expected: businessDay,
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.open(step.open, {
      businessDay: currentDate,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is current date",
        expected: CommonFunction.getSegmentBefore(" ", currentDate),
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);
  });
}
