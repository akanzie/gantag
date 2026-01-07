import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import { CASH_TYPE } from "../../../common/constant/cash_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 端末精算～店舗精算～自動開局（異常系）
erminal settlement - store settlement - automatic opening (abnormal)
 * @memberof 店舗精算
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.STORE_PAYMENT}
 * {@link TAGS.CHECKING_THE_AMOUNT_OF_MONEY}
 * {@link TAGS.TERMINAL_PAYMENT}
 * {@link TAGS.PAYMENT_PROCESSING}
 * {@link TAGS.INVENTORY_INVENTORY_CONTROL_YESNO}
 * {@link TAGS.PENDING_TRANSACTION_CHECK}
 * ### テスト観点
 * * 在高点検～自動開局までの正常系の一連の流れを確認する。
 * * ＜前提条件＞
 * * * 端末精算を行う端末以外で端末精算が未完了の端末が存在すること。
 * * * ・在高点検を実施する。
 * * * ・端末精算を実施する。
 * * * ・店舗精算を実施する。
 * * * * →　端末精算が未完了の端末があるため、エラーとなること。
 * * * \+ ステータス: 220
 * * * \+ エラーメッセージ: "未精算の端末が存在するので、店舗精算が実行できません"
 * * * \+ エラーコード: "STL0006"
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | 準備ステップ | - |
 * | 0.1 | - | `/hold/getList` |
 * | 0.2 | - | `hold/remove` (cart_noが存在すれば削除) | - |
 * | 1 | 在高点検 | `/cash/inspection` |
 * | 2 | 端末精算 | `/settlement` |
 * | 3 | 端末を除外する store`/settlement/exclude-pos` (pos_cd: 04) | - |
 * | 4 | 店舗精算 | `/store/settlement` |
 * | 5 | 端末精算関連のトランを削除（開発用のAPIを実装する必要がある） | - |
 * 
 * ---
 * ### 前提条件
 * * 1. 各POS端末の現金情報は 30,000 円であり、1,000円札が 30 枚含まれていることを前提とする
 * * 2. 保留中の取引がすべて削除されていることを前提とする
 * * 3. store_cd："0080"のPos_cd：01 の端末で精算を実施するが、Pos_cd：02、03、04の端末で精算を実施しない。
 * * #### 4. pos_user_04 を店舗決済計算対象外として、API「store`/settlement/exclude-pos`」を使用して除外する
 * * 5.   テスト開始前に全てのトランを削除する（devtran-cleanerコンテナの起動）
 * * 現状はバックエンドアプリの docker-compose up の時点でdevtran-cleanerが起動されるようになっていますが、テストの連続実行ができない状況
 * 
 * ---
 * ### テストデータ
 * * Requestデータ
 * * 1. cash_info_list:
 * * * \+ total_amount: 30000
 * * * \+ cash_type: 7
 * * * \+ count: 30
 * * 2. storeSettlement
 * * * \+ settlement_datetime: step1でのbusiness_day値
 * * 3. storeSettlementExcludePos: 
 * * * \+ pos_cd: "04"
 * * * \+ settlement_business_day: step1でのbusiness_day値
 * * 4. POS精算情報
 * * * \+ user_cd:  pos_user_01
 * * * \+ user_password: pos_user_01
 * 
 * ---
 * ### 期待結果
 * * #### 1. 在高点検 `/cash/inspection`
 * * \- business_day が有効な日付であることを確認する
 * * \- business_day を取得する
 * * #### 2. 端末精算 `/settlement`
 * * \- business_day が当日日付であることを確認する
 * * #### 3.端末を除外する store`/settlement/exclude-pos` (pos_cd: 04)
 * * \- POS端末は除外するPOSか確認
 * * * \+ pos_cd: 04
 * * * \+ is_settlement_exclude: true
 * * #### 4. 店舗精算 `/store/settlement`
 * * \- レスポンスを確認する
 * * * \+ ステータス: 220
 * * * \+ エラーメッセージ: "未精算の端末が存在するので、店舗精算が実行できません"
 * * * \+ エラーコード: "STL0006"
 */
export function TC_031622001_AutoOpenAbNormal() {
  group("TC_031621001 端末精算～店舗精算～自動開局（異常系）", () => {
    const preStep = {
      holdGetList: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST),
      holdRemove: CommonFunction.getFullDesc(ENDPOINT.HOLD_REMOVE),
    };

    const step = {
      cashInspection: CommonFunction.getFullDesc(ENDPOINT.CASH_INSPECTION),
      settlement: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT),
      storeSettlementExcludePos: CommonFunction.getFullDesc(ENDPOINT.STORE_SETTLEMENT_EXCLUDE_POS),
      storeSettlement: CommonFunction.getFullDesc(ENDPOINT.STORE_SETTLEMENT),
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

    const businessDayCashInspection = TestHelper.cashInspection(step.cashInspection, {
      cashInfoList,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day must be a valid date",
        expected: true,
        actual: (res) => {
          const businessDay = CommonFunction.getSegmentBefore("T", res.result?.business_day);
          return CommonFunction.isValidDate(businessDay);
        },
      }),
    ]).result?.business_day;

    TestHelper.executePosSettlement(step.settlement, {}, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify business day is current date",
        expected: CommonFunction.getSegmentBefore(" ", currentDate),
        actual: (res) => CommonFunction.getSegmentBefore("T", res.result?.business_day),
      }),
    ]);

    TestHelper.storeSettlementExcludePos(step.storeSettlementExcludePos, {
      posCd,
      settlementBusinessDay: businessDayCashInspection,
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
      settlementDatetime: businessDayCashInspection,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("STL0006", "未精算の端末が存在するので、店舗精算が実行できません"),
    ]);
  });
}
