#!/bin/bash

# Script nhanh để check OIDC setup

echo "==================================="
echo "Quick OIDC Setup Check"
echo "==================================="
echo ""

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Không thể lấy AWS Account ID. Kiểm tra AWS credentials"
    exit 1
fi

echo "✓ AWS Account ID: $AWS_ACCOUNT_ID"
echo ""

# Prompt for GitHub repo info
read -p "Nhập GitHub repo (format: owner/repo, ví dụ: adaptive-orchestrator/bmms): " GITHUB_REPO

echo ""
echo "==================================="
echo "1. Checking OIDC Provider"
echo "==================================="

OIDC_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" &>/dev/null; then
    echo "✓ OIDC Provider exists"
else
    echo "❌ OIDC Provider NOT found"
    echo ""
    echo "Tạo bằng lệnh:"
    echo "aws iam create-open-id-connect-provider \\"
    echo "  --url 'https://token.actions.githubusercontent.com' \\"
    echo "  --client-id-list 'sts.amazonaws.com' \\"
    echo "  --thumbprint-list '6938fd4d98bab03faadb97b34396831e3780aea1'"
    exit 1
fi

echo ""
echo "==================================="
echo "2. Checking IAM Role"
echo "==================================="

ROLE_NAME="bmms-dev-GitHubActionsRole"

if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
    echo "✓ IAM Role '$ROLE_NAME' exists"

    # Get trust policy
    TRUST_POLICY=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.AssumeRolePolicyDocument' --output json)

    echo ""
    echo "Trust Policy:"
    echo "$TRUST_POLICY" | jq .

    echo ""
    echo "Checking trust policy conditions..."

    # Check for OIDC in principal
    if echo "$TRUST_POLICY" | jq -e '.Statement[].Principal.Federated' | grep -q "token.actions.githubusercontent.com"; then
        echo "✓ OIDC provider in trust policy"
    else
        echo "❌ OIDC provider MISSING in trust policy"
    fi

    # Check for repo in condition
    if echo "$TRUST_POLICY" | jq -e '.Statement[].Condition' | grep -q "token.actions.githubusercontent.com:sub"; then
        REPO_CONDITION=$(echo "$TRUST_POLICY" | jq -r '.Statement[].Condition.StringLike."token.actions.githubusercontent.com:sub"' 2>/dev/null || echo "$TRUST_POLICY" | jq -r '.Statement[].Condition.StringEquals."token.actions.githubusercontent.com:sub"' 2>/dev/null)
        echo "✓ Repo condition: $REPO_CONDITION"

        # Check if matches input repo
        if echo "$REPO_CONDITION" | grep -q "$GITHUB_REPO"; then
            echo "✓ Repo matches!"
        else
            echo "⚠️  Repo condition không khớp với $GITHUB_REPO"
            echo "   Expected: repo:$GITHUB_REPO:*"
            echo "   Got: $REPO_CONDITION"
        fi
    else
        echo "❌ Repo condition MISSING"
    fi

else
    echo "❌ IAM Role '$ROLE_NAME' NOT found"
    echo ""
    echo "Role cần tạo với tên: GitHubActionsRole"
    exit 1
fi

echo ""
echo "==================================="
echo "3. Checking IAM Policies"
echo "==================================="

POLICIES=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query 'AttachedPolicies[*].PolicyName' --output text)

if [ -z "$POLICIES" ]; then
    echo "❌ No policies attached to role"
else
    echo "✓ Attached policies:"
    echo "$POLICIES"
fi

echo ""
echo "==================================="
echo "4. Recommended Trust Policy"
echo "==================================="

cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

echo ""
echo "==================================="
echo "5. Fix Command (if needed)"
echo "==================================="

cat > /tmp/trust-policy-fix.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

echo "Nếu trust policy không đúng, chạy lệnh sau để fix:"
echo ""
echo "aws iam update-assume-role-policy \\"
echo "  --role-name GitHubActionsRole \\"
echo "  --policy-document file:///tmp/trust-policy-fix.json"
echo ""

echo "==================================="
echo "6. GitHub Secrets Required"
echo "==================================="

echo ""
echo "Thêm secret sau vào GitHub repo:"
echo "Repository: https://github.com/${GITHUB_REPO}/settings/secrets/actions"
echo ""
echo "Secret name: AWS_ACCOUNT_ID"
echo "Secret value: ${AWS_ACCOUNT_ID}"
echo ""

echo "==================================="
echo "Done!"
echo "==================================="
